// server/src/cron/autoResolveDisputes.js
import mongoose from "mongoose";
import ShiftRecord from "../models/ShiftRecord.js";
import Application from "../models/Application.js";
import Shift from "../models/Shift.js";
import Dispute from "../models/Dispute.js";
import { finalizeUndisputedForceClockOut } from "../services/settlementService.js";
import {
  settleDispute,
  emitDisputeResolved,
} from "../services/disputeService.js";
import {safeEmit} from "../utils/notify.js";
import User from "../models/User.js";
import { enforceBan } from "../services/banService.js";
import { broadcastToRole } from "../utils/notify.js";

import { logError } from "../utils/logger.js";
// Sweep 1: force-clock-outs nobody disputed within 24h.
export async function runAutoFinalizePendingResolutions() {
  const overdue = await ShiftRecord.find({
    status: "pending_resolution",
    disputeWindowExpiresAt: { $lt: new Date() },
  }).limit(200)
    .populate("application")
    .populate({ path: "shift", populate: "employer" });

  let finalized = 0;
  for (const shiftRecord of overdue) {
    const session = await mongoose.startSession();
    let didFinalize = false;
    try {
      await session.withTransaction(async () => {
        didFinalize = false;
        // Re-check inside the transaction — the worker may have disputed
        // between the query above and now.
        const fresh = await ShiftRecord.findOne({
          _id: shiftRecord._id,
          status: "pending_resolution",
        }).session(session);
        if (!fresh) return;
        await finalizeUndisputedForceClockOut({
          shiftRecord,
          application: shiftRecord.application,
          shift: shiftRecord.shift,
          session,
        });
        didFinalize = true;
      });

            if (didFinalize) {
        const payload = {
          shiftId: shiftRecord.shift._id,
          amountEarned: shiftRecord.amountEarned,
        };

        // Notify worker
        safeEmit(shiftRecord.worker, "shift:force_clockout_finalized", payload);

        // 👇 NAYA: Notify employer bhi
        if (shiftRecord.shift.employer?.user) {
          safeEmit(
            shiftRecord.shift.employer.user,
            "shift:force_clockout_finalized",
            payload,
          );
        }

        finalized++;
      }
    } catch (err) {
      logError(`Auto-finalize failed for ShiftRecord ${shiftRecord._id}:`, err);
    } finally {
      session.endSession();
    }
  }
  if (finalized > 0)
    console.log(`✅ Auto-finalized ${finalized} undisputed force-clock-out(s)`);
  return finalized;
}

// Sweep 2: disputes where the employer never uploaded proof within 48h.
export async function runAutoRuleDisputes() {
  const overdue = await Dispute.find({
    status: "awaiting_proof",
    proofDeadline: { $lt: new Date() },
  }).limit(200);

  let ruled = 0;
  for (const dispute of overdue) {
    let resolvedDispute = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        resolvedDispute = null;
        const fresh = await Dispute.findOne({
          _id: dispute._id,
          status: "awaiting_proof",
        }).session(session);
        if (!fresh) return; // proof arrived right before this ran
        const shiftRecord = await ShiftRecord.findById(
          dispute.shiftRecord,
        ).session(session);
        const application = await Application.findById(
          dispute.application,
        ).session(session);
        const shift = await Shift.findById(dispute.shift)
          .populate("employer")
          .session(session);
        resolvedDispute = await settleDispute({
          dispute,
          shiftRecord,
          application,
          shift,
          ruledFor: "worker",
          ruledBy: null,
          resolution:
            "Employer did not submit proof within 48 hours; auto-ruled in the worker's favor.",
          autoResolved: true,
          session,
        });
      });
            if (resolvedDispute) {
        emitDisputeResolved(resolvedDispute);

        // 👇 NAYA: Auto-rule ke baad loser (employer) ka ban check karein
        const loser = await User.findById(dispute.employer).select("isBanned");
        if (loser?.isBanned) {
          enforceBan(dispute.employer).catch((err) =>
            logError("enforceBan failed (auto-rule):", err),
          );
        }

         broadcastToRole("admin", "admin:queue_changed", { kind: "dispute" });

        ruled++;
      }
    } catch (err) {
      logError(`Auto-rule failed for Dispute ${dispute._id}:`, err);
    } finally {
      session.endSession();
    }
  }
  if (ruled > 0)
    console.log(`✅ Auto-ruled ${ruled} unproven dispute(s) for the worker`);
  return ruled;
}
