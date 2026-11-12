// server/src/services/settlementService.js
import Worker from "../models/Worker.js";
import Employer from "../models/Employer.js";
import ShiftRecord from "../models/ShiftRecord.js";
import { adjustWallet } from "./walletService.js";
import Application from "../models/Application.js";
import { recomputeShiftStatus } from "./shiftStatusService.js";
/**
 * Pure math, no DB writes — same capping logic your original clock-out
 * used: never pay for time past the scheduled end, never negative hours.
 * Capped a second time at escrowAmount as a hard ceiling, protecting
 * against float drift ever letting a payout exceed what was locked.
 */
export function computeSettlementSplit({ clockIn, exitTime, scheduledStart, scheduledEnd, hourlyPayAtLock, escrowAmount }) {
  const effectiveStart = Math.max(clockIn.getTime(), scheduledStart.getTime());
  const effectiveEnd = Math.min(exitTime.getTime(), scheduledEnd.getTime());
  const payableMs = Math.max(0, effectiveEnd - effectiveStart);

  // hourlyPayAtLock is stored in PAISE per hour (matches escrowAmount units).
  const workerAmount = Math.min(
    Math.round((payableMs / 3600000) * hourlyPayAtLock),
    escrowAmount,
  );

  return {
    hoursWorked: +(payableMs / 3600000).toFixed(2),
    workerAmount,
    employerRefund: escrowAmount - workerAmount,
  };
}

/**
 * Actually MOVES money. Call this only when a settlement is FINAL — happy
 * path, Path C auto-close, the future 24h auto-finalize, or a resolved
 * dispute. Never call it just to store a proposed split.
 */
export async function finalizeSettlement({
  shiftRecordId, applicationId, workerUserId, employerUserId, employerId,
  workerAmount, employerRefund, shiftId, session, exitMethod, extra = {},
}) {

   const existing = await ShiftRecord.findById(shiftRecordId).session(session);
  if (existing && existing.status === "completed" && existing.paymentStatus === "paid") {
    console.warn(`[Settlement] Skipped - ShiftRecord ${shiftRecordId} already settled.`);
    return existing;
  }
  if (workerAmount > 0) {
    await adjustWallet({
      userId: workerUserId, delta: workerAmount, type: "escrow_release",
      amount: workerAmount, shift: shiftId, application: applicationId, session,
    });
  }
  if (employerRefund > 0) {
    await adjustWallet({
      userId: employerUserId, delta: employerRefund, type: "escrow_refund",
      amount: employerRefund, shift: shiftId, application: applicationId, session,
    });
  }

  await Worker.findOneAndUpdate(
    { user: workerUserId },
    { $inc: { totalEarnings: workerAmount, shiftsCompleted: 1 } },
    { session },
  );
  if (employerId) {
    await Employer.findByIdAndUpdate(employerId, { $inc: { totalSpent: workerAmount } }, { session });
  }

  const record =  await ShiftRecord.findByIdAndUpdate(
    shiftRecordId,
    { amountEarned: workerAmount, employerRefund, paymentStatus: "paid", status: "completed", exitMethod, ...extra },
    { returnDocument: 'after', session },
  );

  await Application.findByIdAndUpdate(
    applicationId,
    {status: "completed", escrowStatus: "released", escrowReleasedAt: new Date()},
    {session},
  )

  await recomputeShiftStatus(shiftId, session);

  return record;
}


/**
 * The 24h window passed and the worker never disputed — accept the
 * employer's proposed force-clock-out numbers as final. No strike: an
 * undisputed force-clock-out isn't a trust violation, it's just silence.
 */
export async function finalizeUndisputedForceClockOut({ shiftRecord, application, shift, session }) {
  return await finalizeSettlement({
    shiftRecordId: shiftRecord._id,
    applicationId: application._id,
    workerUserId: shiftRecord.worker,
    employerUserId: shift.employer.user,
    employerId: shift.employer._id,
    workerAmount: shiftRecord.amountEarned,       // already computed at force-clock-out time
    employerRefund: shiftRecord.employerRefund,   // already computed at force-clock-out time
    shiftId: shift._id,
    session,
    exitMethod: "forced",
  });
}