// server/src/services/disputeService.js
import Dispute from "../models/Dispute.js";
import ShiftRecord from "../models/ShiftRecord.js";
import Application from "../models/Application.js";
import Shift from "../models/Shift.js";
import { HttpError } from "../utils/HttpError.js";
import { computeSettlementSplit, finalizeSettlement } from "./settlementService.js";
import { applyStrike } from "./strikeServices.js";
import { safeEmit } from "../utils/notify.js";

export async function raiseDispute({ shiftRecordId, workerUserId, reason, claimedTime, session }) {
  const shiftRecord = await ShiftRecord.findById(shiftRecordId).session(session);
  if (!shiftRecord) throw new HttpError(404, "Shift record not found");
  if (shiftRecord.worker.toString() !== workerUserId.toString()) {
    throw new HttpError(403, "This isn't your shift record");
  }
  if (shiftRecord.status !== "pending_resolution") {
    throw new HttpError(409, "This shift isn't awaiting your response");
  }
  if (shiftRecord.disputeWindowExpiresAt && shiftRecord.disputeWindowExpiresAt < new Date()) {
    throw new HttpError(409, "The 24-hour window to dispute this has passed");
  }

  const application = await Application.findById(shiftRecord.application).session(session);
  const shift = await Shift.findById(shiftRecord.shift).populate("employer").session(session);

  const [dispute] = await Dispute.create(
    [
      {
        shift: shift._id,
        application: application._id,
        shiftRecord: shiftRecord._id,
        worker: workerUserId,
        employer: shift.employer.user,
        raisedBy: workerUserId,
        reason,
        workerClaimedClockOut: claimedTime,
        proofDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    ],
    { session },
  );

  await ShiftRecord.findByIdAndUpdate(shiftRecord._id, { status: "disputed", dispute: dispute._id }, { session });
  await Application.findByIdAndUpdate(application._id, { status: "disputed", dispute: dispute._id }, { session });

  return dispute;
}

export async function submitEvidence({
  disputeId,
  employerUserId,
  evidencePublicIds,
  evidenceResourceTypes,
  session,
}) {
  const dispute = await Dispute.findById(disputeId).session(session);
  if (!dispute) throw new HttpError(404, "Dispute not found");
  if (dispute.employer.toString() !== employerUserId.toString()) {
    throw new HttpError(403, "This isn't your dispute");
  }
  if (dispute.status !== "awaiting_proof") {
    throw new HttpError(409, "This dispute is no longer accepting evidence");
  }
  if (dispute.proofDeadline < new Date()) {
    throw new HttpError(409, "The 48-hour proof window has passed");
  }
  if (!evidencePublicIds?.length) {
    throw new HttpError(400, "At least one evidence file is required");
  }
  // Parallel arrays must line up or signed-URL generation breaks.
  if (evidencePublicIds.length !== (evidenceResourceTypes?.length ?? 0)) {
    throw new HttpError(400, "Evidence metadata mismatch");
  }

  return Dispute.findByIdAndUpdate(
    disputeId,
    {
      evidencePublicIds,
      evidenceResourceTypes,
      evidenceSubmittedAt: new Date(),
      status: "under_review",
    },
    { returnDocument: "after", session },
  );
}

/**
 * The one function that actually decides a dispute — called from BOTH the
 * admin's manual ruling and the 48h no-proof auto-rule cron, so the money
 * and strike logic can never drift between "a human decided" and "the
 * system decided by default."
 *
 * ruledFor "worker"   -> worker gets the FULL escrow amount (we don't trust
 *                        the employer's forced exit-time claim). Employer
 *                        loses -> strike.
 * ruledFor "employer" -> the ORIGINAL force-clock-out numbers stand (the
 *                        partial hours computed back at force-clock-out
 *                        time). Worker loses -> strike.
 */
export async function settleDispute({
  dispute, shiftRecord, application, shift, ruledFor, ruledBy, resolution, autoResolved, session,
}) {
   let finalExitTime;
  if (ruledFor === "worker") {
    finalExitTime = dispute.workerClaimedClockOut;
  } else {
    finalExitTime = shiftRecord.clockOut;
  }

  const { hoursWorked, workerAmount, employerRefund } = computeSettlementSplit({
    clockIn: shiftRecord.clockIn,
    exitTime: finalExitTime,
    scheduledStart: application.scheduledStartAtLock,
    scheduledEnd: application.scheduledEndAtLock,
    hourlyPayAtLock: application.hourlyPayAtLock,
    escrowAmount: application.escrowAmount,
  });

    await finalizeSettlement({
    shiftRecordId: shiftRecord._id,
    applicationId: application._id,
    workerUserId: dispute.worker,
    employerUserId: dispute.employer,
    employerId: shift.employer._id,
    workerAmount,
    employerRefund,
    shiftId: shift._id,
    session,
    exitMethod: "disputed",
    extra: {
      hoursWorked,
      clockOut: finalExitTime, // Update ShiftRecord with the new final time
      amountEarned: workerAmount,
    },
  });



  const loserUserId = ruledFor === "worker" ? dispute.employer : dispute.worker;
  await applyStrike({
    userId: loserUserId,
    reason: autoResolved
      ? "Lost a dispute by default — no proof submitted within 48 hours"
      : `Lost a dispute over shift record ${shiftRecord._id}`,
    source: "dispute_loss",
    shift: shift._id,
    application: application._id,
    dispute: dispute._id,
    session,
  });

  return Dispute.findByIdAndUpdate(
    dispute._id,
    { status: "resolved", ruledFor, ruledBy, autoResolved, resolution, resolvedAt: new Date() },
    { returnDocument: 'after', session },
  );
}

// add at the bottom of the file, after settleDispute

/**
 * Fires the live-update for a resolved dispute to BOTH parties.
 *
 * Call this AFTER the transaction commits — never inside withTransaction —
 * so a rollback can't tell clients "resolved" while the DB disagrees.
 * Kept here (not duplicated in the route + cron) so the payload shape
 * can never drift between the manual and auto-resolve paths.
 */
export function emitDisputeResolved(dispute) {
  const payload = {
    disputeId: dispute._id,
    status: dispute.status,
    ruledFor: dispute.ruledFor,
    autoResolved: dispute.autoResolved,
    resolvedAt: dispute.resolvedAt,
  };
  safeEmit(dispute.worker, "dispute:resolved", payload);
  safeEmit(dispute.employer, "dispute:resolved", payload);
}