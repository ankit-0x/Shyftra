// server/src/services/shiftStatusService.js
import Shift from "../models/Shift.js";
import Application from "../models/Application.js";

const IN_FLIGHT_STATUSES = [
  "accepted",
  "in_progress",
  "pending_resolution",
  "disputed",
];
const TERMINAL_SHIFT_STATUSES = ["cancelled", "completed", "expired"];

/**
 * Recompute a shift's status based on its applications and current time.
 *
 * Rules:
 *  1. Terminal shifts (completed/cancelled/expired) → never touched.
 *  2. Shift not yet started:
 *       - acceptedCount >= workersNeeded → "filled"
 *       - acceptedCount < workersNeeded  → "open"
 *       - Do NOT reject pending apps — the shift can still reopen if an
 *         accepted worker cancels. Rejecting pending would permanently block
 *         those workers from being re-accepted.
 *  3. Shift started, any in-flight worker → leave status alone (still running).
 *  4. Shift started, no in-flight workers:
 *       - ≥1 completed  → "completed" + reject remaining pending
 *       - 0 completed   → "expired"   + reject remaining pending
 */
export async function recomputeShiftStatus(shiftId, session) {
  const shift = await Shift.findById(shiftId).session(session);
  if (!shift || TERMINAL_SHIFT_STATUSES.includes(shift.status)) return;

  const now = new Date();
  const hasStarted = shift.startTime <= now;

  const inFlightCount = await Application.countDocuments({
    shift: shiftId,
    status: { $in: IN_FLIGHT_STATUSES },
  }).session(session);

  const completedCount = await Application.countDocuments({
    shift: shiftId,
    status: "completed",
  }).session(session);

  const pendingCount = await Application.countDocuments({
    shift: shiftId,
    status: "pending",
  }).session(session);

  // ─────────────────────────────────────────────────────────────
  // CASE A — Shift has not started yet
  // ─────────────────────────────────────────────────────────────
  if (!hasStarted) {
    const fullEnough = shift.acceptedCount >= shift.workersNeeded;

    if (fullEnough && shift.status !== "filled") {
      shift.status = "filled";
      await shift.save({ session });
    } else if (!fullEnough && shift.status === "filled") {
      // an accepted worker cancelled, opening up a slot
      shift.status = "open";
      await shift.save({ session });
    }
    // Pending stays pending — shift may reopen again before it starts.
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // CASE B — Shift has started, but a worker is still actively in
  //          flight (accepted / in_progress / pending_resolution /
  //          disputed). Leave status alone.
  // ─────────────────────────────────────────────────────────────
  if (inFlightCount > 0) return;

  // ─────────────────────────────────────────────────────────────
  // CASE C — Shift has started, nobody left in flight → it's over.
  // ─────────────────────────────────────────────────────────────
  const finalStatus = completedCount > 0 ? "completed" : "expired";
  const rejectReason =
    completedCount > 0
      ? "Shift completed before you were selected"
      : "Shift expired before you were selected";

  if (shift.status !== finalStatus) {
    shift.status = finalStatus;
    await shift.save({ session });
  }

  if (pendingCount > 0) {
    await Application.updateMany(
      { shift: shiftId, status: "pending" },
      {
        $set: {
          status: "rejected",
          cancellationReason: rejectReason,
        },
      },
      { session },
    );
  }
}