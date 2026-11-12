// server/src/cron/autoCloseShifts.js
import mongoose from "mongoose";
import ShiftRecord from "../models/ShiftRecord.js";
import {
  finalizeSettlement,
  computeSettlementSplit,
} from "../services/settlementService.js";
import { recomputeShiftStatus } from "../services/shiftStatusService.js";
import { safeEmit } from "../utils/notify.js";
import { closeShiftIfIdle } from "./expireStaleWork.js";

import { logError } from "../utils/logger.js";
const GRACE_PERIOD_HOURS = 3;

/**
 * Anyone still "ongoing" 3+ hours past their scheduled end gets settled
 * for the time they were actually clocked in: up to the moment they asked
 * to leave (exit code requested), or the scheduled end if they never did.
 * Never more than the locked escrow.
 *
 * After settlement we recompute the shift status and reject any lingering
 * "pending" applications on that shift. `closeShiftIfIdle` also guarantees
 * the shift ends as "completed" once no active applications remain.
 */
export async function runAutoCloseShifts() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  const overdue = await ShiftRecord.find({
    status: "ongoing",
    scheduledEnd: { $lt: cutoff },
  })
    .limit(200)
    .populate("application")
    .populate({ path: "shift", populate: "employer" });

  let closed = 0;
  for (const shiftRecord of overdue) {
    // Defensive guards — populated refs must exist, otherwise settlement
    // data is insufficient and we must not mutate money.
    if (!shiftRecord.application) {
      console.warn(
        `ShiftRecord ${shiftRecord._id}: application missing — skipping`,
      );
      continue;
    }
    if (!shiftRecord.shift) {
      console.warn(`ShiftRecord ${shiftRecord._id}: shift missing — skipping`);
      continue;
    }
    if (!shiftRecord.shift.employer || !shiftRecord.shift.employer.user) {
      console.warn(
        `ShiftRecord ${shiftRecord._id}: employer/user missing — skipping`,
      );
      continue;
    }

    const session = await mongoose.startSession();
    let paid = null;
    try {
      await session.withTransaction(async () => {
        paid = null;
        const fresh = await ShiftRecord.findOne({
          _id: shiftRecord._id,
          status: "ongoing",
        }).session(session);
        if (!fresh) return;

        const application = shiftRecord.application;
        const employer = shiftRecord.shift.employer;

        const scheduledEnd = application.scheduledEndAtLock;
        const exitTime = fresh.exitOtpRequestedAt ?? scheduledEnd;

        const { hoursWorked, workerAmount, employerRefund } =
          computeSettlementSplit({
            clockIn: fresh.clockIn,
            exitTime,
            scheduledStart: application.scheduledStartAtLock,
            scheduledEnd,
            hourlyPayAtLock: application.hourlyPayAtLock,
            escrowAmount: application.escrowAmount,
          });

        await finalizeSettlement({
          shiftRecordId: shiftRecord._id,
          applicationId: application._id,
          workerUserId: shiftRecord.worker,
          employerUserId: employer.user,
          employerId: employer._id,
          workerAmount,
          employerRefund,
          shiftId: shiftRecord.shift._id,
          session,
          exitMethod: "auto_cron",
          extra: {
            autoClosedAt: new Date(),
            hoursWorked,
            clockOut: new Date(
              Math.min(exitTime.getTime(), scheduledEnd.getTime()),
            ),
          },
        });

        // Recompute shift status now that this application is settled.
        await recomputeShiftStatus(shiftRecord.shift._id, session);

        // If the last active application on this shift just closed,
        // guarantee the shift ends as "completed" and reject any pending
        // applications that can no longer be filled.
        await closeShiftIfIdle(shiftRecord.shift._id, session, {
          expireIfEmpty: false,
          fallbackToCompleted: true,
          pendingReason: "Shift closed before it could be filled",
        });

        paid = workerAmount;
      });

      if (paid !== null) {
        // 1. Notify the Worker
        safeEmit(shiftRecord.worker, "shift:auto_closed", {
          shiftId: shiftRecord.shift._id,
          amountEarned: paid,
        });

        // 2. Notify the Employer
        if (shiftRecord.shift.employer?.user) {
          safeEmit(shiftRecord.shift.employer.user, "shift:auto_closed", {
            shiftId: shiftRecord.shift._id,
            amountEarned: paid,
          });
        }

        closed++;
      }
    } catch (err) {
      logError(`Auto-close failed for ShiftRecord ${shiftRecord._id}:`, err);
    } finally {
      session.endSession();
    }
  }

  if (closed > 0) console.log(`✅ Auto-closed ${closed} overdue shift(s)`);
  return closed;
}