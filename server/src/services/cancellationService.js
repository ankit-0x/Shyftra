// server/src/services/cancellationService.js
import { adjustWallet } from "./walletService.js";
import { applyStrike } from "./strikeServices.js";
import { HttpError } from "../utils/HttpError.js";
import {
  LATE_CANCELLATION_WINDOW_HOURS,
  LATE_CANCELLATION_PENALTY_FLAT,
  WORKER_FREE_CANCEL_HOURS,
} from "../config/businessRules.js";
import Shift from "../models/Shift.js";

function assertEscrowLocked(application) {
  if (application.escrowStatus !== "locked") {
    throw new HttpError(409, "This application has no active escrow to cancel");
  }
}

/**
 * What WOULD happen if this worker cancelled this accepted application right
 * now? Pure function (no DB, no writes) shared by the preview endpoint and
 * the real cancel route, so the warning the worker sees can never disagree
 * with what actually happens.
 */
export function getWorkerCancelOutcome(application, now = Date.now()) {
  const hoursUntilStart =
    (application.scheduledStartAtLock.getTime() - now) / (1000 * 60 * 60);
  const free =
    WORKER_FREE_CANCEL_HOURS > 0 &&
    !application.arrivedAt &&
    hoursUntilStart >= WORKER_FREE_CANCEL_HOURS;
  return {
    free,
    hoursUntilStart: Math.max(0, +hoursUntilStart.toFixed(1)),
    freeCancelHours: WORKER_FREE_CANCEL_HOURS,
    alreadyArrived: !!application.arrivedAt,
  };
}

/**
 * Worker-fault path: employer marks a no-show, OR the worker self-cancels
 * an accepted shift.
 */
export async function cancelByWorkerFault({
  application,
  employerUserId,
  workerUserId,
  reason,
  noShow,
  applyStrikeToWorker = true,
  session,
}) {
  assertEscrowLocked(application);
  const refundAmount = application.escrowAmount;

  await adjustWallet({
    userId: employerUserId,
    delta: refundAmount,
    type: "escrow_refund",
    amount: refundAmount,
    shift: application.shift,
    application: application._id,
    session,
  });

  application.status = "cancelled_by_worker";
  application.escrowStatus = "released";
  application.escrowReleasedAt = new Date();
  application.cancelledAt = new Date();
  application.cancellationReason = reason;
  application.noShow = noShow;
  application.strikeApplied = applyStrikeToWorker;   // ✅ NEW
  application.refundToEmployer = refundAmount;
  application.penaltyToWorker = 0;
  await application.save({ session });

  await Shift.updateOne(
    { _id: application.shift, acceptedCount: { $gt: 0 } },
    { $inc: { acceptedCount: -1 } },
    { session },
  );

  if (applyStrikeToWorker) {
    await applyStrike({
      userId: workerUserId,
      reason: noShow
        ? "Marked as a no-show by the employer"
        : "Cancelled an already-accepted shift",
      source: noShow ? "no_show" : "worker_cancellation",
      shift: application.shift,
      application: application._id,
      session,
    });
  }

  return application;
}

export async function cancelByEmployer({
  application,
  employerUserId,
  workerUserId,
  reason,
  session,
}) {
  assertEscrowLocked(application);

  const hoursUntilStart =
    (application.scheduledStartAtLock.getTime() - Date.now()) /
    (1000 * 60 * 60);
  const isLate = hoursUntilStart < LATE_CANCELLATION_WINDOW_HOURS;

  const penaltyToWorker = isLate
    ? Math.min(LATE_CANCELLATION_PENALTY_FLAT, application.escrowAmount)
    : 0;
  const refundToEmployer = application.escrowAmount - penaltyToWorker;

  if (penaltyToWorker > 0) {
    await adjustWallet({
      userId: workerUserId,
      delta: penaltyToWorker,
      type: "cancellation_penalty",
      amount: penaltyToWorker,
      shift: application.shift,
      application: application._id,
      session,
    });
  }
  if (refundToEmployer > 0) {
    await adjustWallet({
      userId: employerUserId,
      delta: refundToEmployer,
      type: "escrow_refund",
      amount: refundToEmployer,
      shift: application.shift,
      application: application._id,
      session,
    });
  }

  application.status = "cancelled_by_employer";
  application.escrowStatus = "released";
  application.escrowReleasedAt = new Date();
  application.cancelledAt = new Date();
  application.cancellationReason = reason;
  application.noShow = false;
  application.refundToEmployer = refundToEmployer;
  application.penaltyToWorker = penaltyToWorker;
  await application.save({ session });

  await Shift.updateOne(
    { _id: application.shift, acceptedCount: { $gt: 0 } },
    { $inc: { acceptedCount: -1 } },
    { session },
  );

  return { application, isLate, penaltyToWorker, refundToEmployer };
}

export async function reopenShiftIfNeeded(shift, session) {
  const fresh = await Shift.findById(shift._id).session(session);
  if (!fresh) return;

  if (
    fresh.status === "filled" &&
    fresh.startTime > new Date() &&
    fresh.acceptedCount < fresh.workersNeeded
  ) {
    fresh.status = "open";
    await fresh.save({ session });
  }
}