// server/src/cron/expireStaleWork.js
import mongoose from "mongoose";
import Application from "../models/Application.js";
import Shift from "../models/Shift.js";
import ShiftRecord from "../models/ShiftRecord.js";
import { adjustWallet } from "../services/walletService.js";
import { cancelByEmployer } from "../services/cancellationService.js";
import { recomputeShiftStatus } from "../services/shiftStatusService.js";
import { safeEmit, broadcastToRole } from "../utils/notify.js";

import { logError } from "../utils/logger.js";
const GRACE_HOURS = 3;
const BATCH = 200;
const TERMINAL_SHIFT_STATUSES = ["expired", "completed", "cancelled"];
const ORPHAN_INPROGRESS_HOURS = 24;
const ACTIVE_APP_STATUSES = [
  "accepted",
  "in_progress",
  "pending_resolution",
  "disputed",
];

export async function closeShiftIfIdle(
  shiftId,
  session,
  {
    expireIfEmpty = true,
    fallbackToCompleted = false,
    pendingReason = "Shift expired before it was filled",
  } = {},
) {
  const remainingActive = await Application.countDocuments({
    shift: shiftId,
    status: { $in: ACTIVE_APP_STATUSES },
  }).session(session);

  if (remainingActive > 0) return false;

  const completedCount = await Application.countDocuments({
    shift: shiftId,
    status: "completed",
  }).session(session);

  let targetStatus = null;
  if (completedCount > 0) {
    targetStatus = "completed";
  } else if (expireIfEmpty) {
    targetStatus = "expired";
  } else if (fallbackToCompleted) {
    targetStatus = "completed";
  }

  if (targetStatus) {
    await Shift.updateOne(
      { _id: shiftId, status: { $in: ["open", "filled"] } },
      { $set: { status: targetStatus } },
      { session },
    );
  }

  await Application.updateMany(
    { shift: shiftId, status: "pending" },
    { $set: { status: "rejected", cancellationReason: pendingReason } },
    { session },
  );

  return true;
}

export async function runExpireUnstartedApplications() {
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);
  const overdue = await Application.find({
    status: "accepted",
    escrowStatus: "locked",
    scheduledEndAtLock: { $lt: cutoff },
  }).limit(BATCH);

  let expired = 0;
  for (const candidate of overdue) {
    const session = await mongoose.startSession();
    let outcome = null;
    try {
      await session.withTransaction(async () => {
        outcome = null;
        const application = await Application.findOne({
          _id: candidate._id,
          status: "accepted",
          escrowStatus: "locked",
        }).session(session);
        if (!application) return;

        const shift = await Shift.findById(application.shift)
          .populate("employer")
          .session(session);
        if (!shift) {
          console.warn(
            `Application ${application._id}: shift ${application.shift} missing — skipping`,
          );
          return;
        }
        if (!shift.employer || !shift.employer.user) {
          console.warn(
            `Shift ${shift._id}: employer/user missing — cannot process application ${application._id}`,
          );
          return;
        }
        const employerUserId = shift.employer.user;

        let penalty = 0;
        if (application.arrivedAt) {
          const r = await cancelByEmployer({
            application,
            employerUserId,
            workerUserId: application.worker,
            reason: "Worker arrived but the employer never started the shift",
            session,
          });
          penalty = r.penaltyToWorker;
        } else {
          await adjustWallet({
            userId: employerUserId,
            delta: application.escrowAmount,
            type: "escrow_refund",
            amount: application.escrowAmount,
            shift: application.shift,
            application: application._id,
            session,
          });
          application.status = "expired";
          application.escrowStatus = "released";
          application.escrowReleasedAt = new Date();
          application.refundToEmployer = application.escrowAmount;
          application.cancellationReason =
            "Worker never checked in and the shift ended";
          await application.save({ session });
          await Shift.updateOne(
            { _id: application.shift, acceptedCount: { $gt: 0 } },
            { $inc: { acceptedCount: -1 } },
            { session },
          );
        }

        await recomputeShiftStatus(application.shift, session);

        // ✅ Capture pending apps BEFORE closeShiftIfIdle rejects them so we
        // can notify each worker individually after commit.
        const pendingApps = await Application.find({
          shift: application.shift,
          status: "pending",
        })
          .select("_id worker")
          .session(session)
          .lean();

        // ✅ FIX: pendingReason distinguishes "someone arrived" from "nobody
        // ever showed up" — the shift already had a physical presence.
        const pendingReason = application.arrivedAt
          ? "Shift ended before it could be completed"
          : "Shift expired before it was filled";

        await closeShiftIfIdle(application.shift, session, {
          expireIfEmpty: true,
          fallbackToCompleted: true,
          pendingReason,
        });

        outcome = {
          workerId: application.worker,
          employerUserId,
          shiftId: application.shift,
          shiftTitle: shift.title,
          arrived: !!application.arrivedAt,
          penalty,
          pendingApps: pendingApps.map((a) => ({
            applicationId: a._id,
            workerId: a.worker,
          })),
        };
      });

      if (outcome) {
        safeEmit(outcome.workerId, "shift:expired", {
          shiftId: outcome.shiftId,
          penaltyPaidToYou: outcome.penalty,
        });
        safeEmit(outcome.employerUserId, "shift:expired", {
          shiftId: outcome.shiftId,
        });
        // ✅ Rejected co-workers (pending apps on the same shift) get a
        // dedicated rejection so their MyApplications UI updates + toast.
        for (const pa of outcome.pendingApps || []) {
          safeEmit(pa.workerId, "shift:rejected", {
            applicationId: pa.applicationId,
            shiftId: outcome.shiftId,
            shiftTitle: outcome.shiftTitle,
          });
        }
        expired++;
      }
    } catch (err) {
      logError(`Expire failed for Application ${candidate._id}:`, err);
    } finally {
      session.endSession();
    }
  }
  if (expired > 0) console.log(`✅ Expired ${expired} unstarted application(s)`);
  return expired;
}

export async function runExpireStaleShifts() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await Shift.find({
    status: "open",
    acceptedCount: 0,
    startTime: { $lt: cutoff },
  })
    .select("_id")
    .limit(BATCH)
    .lean();

  let shiftsExpired = 0;
  let expiredIds = [];

  // -------- Phase 1 --------
  if (stale.length > 0) {
    const ids = stale.map((s) => s._id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Shift.updateMany(
          { _id: { $in: ids }, status: "open", acceptedCount: 0 },
          { $set: { status: "expired" } },
          { session },
        );
        expiredIds = (
          await Shift.find({ _id: { $in: ids }, status: "expired" })
            .select("_id")
            .session(session)
            .lean()
        ).map((s) => s._id);
        shiftsExpired = expiredIds.length;
        await Application.updateMany(
          { shift: { $in: expiredIds }, status: "pending" },
          {
            $set: {
              status: "rejected",
              cancellationReason: "Shift expired before it was filled",
            },
          },
          { session },
        );
      });
    } finally {
      session.endSession();
    }

    // ✅ FIX: notify employers (per-shift) + generic worker tick.
    if (shiftsExpired > 0) {
      try {
        const expiredShifts = await Shift.find({
          _id: { $in: expiredIds },
          status: "expired",
        })
          .populate("employer", "user")
          .select("_id employer")
          .lean();

        for (const s of expiredShifts) {
          if (s.employer?.user) {
            safeEmit(s.employer.user, "shift:expired", { shiftId: s._id });
          }
        }

        broadcastToRole("worker", "shifts:changed", { reason: "expired" });
      } catch (err) {
        logError("expireStaleShifts Phase 1 notify failed:", err);
      }
    }
  }

  // -------- Phase 2 --------
  let pendingRejected = 0;
  try {
    const orphaned = await Application.aggregate([
      { $match: { status: "pending" } },
      {
        $lookup: {
          from: Shift.collection.name,
          localField: "shift",
          foreignField: "_id",
          as: "shiftDoc",
        },
      },
      { $match: { "shiftDoc.status": { $in: TERMINAL_SHIFT_STATUSES } } },
      { $limit: BATCH },
      { $project: { _id: 1, worker: 1, shift: 1 } },
    ]);

    if (orphaned.length > 0) {
      const orphanIds = orphaned.map((a) => a._id);
      const res = await Application.updateMany(
        { _id: { $in: orphanIds }, status: "pending" },
        {
          $set: {
            status: "rejected",
            cancellationReason: "Shift expired before it was filled",
          },
        },
      );
      pendingRejected = res.modifiedCount || 0;

      // ✅ FIX: notify each orphaned worker so their UI refreshes.
      for (const orphan of orphaned) {
        safeEmit(orphan.worker, "shift:rejected", {
          applicationId: orphan._id,
          shiftId: orphan.shift,
        });
      }
    }
  } catch (err) {
    logError("Orphaned pending-application cleanup failed:", err);
  }

  // -------- Phase 3 (log-only) --------
  try {
    const orphanThreshold = new Date(
      Date.now() - ORPHAN_INPROGRESS_HOURS * 60 * 60 * 1000,
    );
    const stuckInProgress = await Application.find({
      status: "in_progress",
      scheduledEndAtLock: { $lt: orphanThreshold },
    })
      .select("_id shift")
      .limit(BATCH)
      .lean();

    if (stuckInProgress.length > 0) {
      const shiftIds = [...new Set(stuckInProgress.map((a) => a.shift))];
      const haveRecords = new Set(
        (
          await ShiftRecord.find({ shift: { $in: shiftIds } })
            .select("shift")
            .lean()
        ).map((r) => String(r.shift)),
      );
      const orphaned = stuckInProgress.filter(
        (a) => !haveRecords.has(String(a.shift)),
      );
      if (orphaned.length > 0) {
        console.warn(
          `⚠️ ${orphaned.length} in_progress application(s) with no matching ShiftRecord — manual review needed:`,
          orphaned.map((a) => String(a._id)),
        );
      }
    }
  } catch (err) {
    logError("Orphan in_progress detection failed:", err);
  }

  if (shiftsExpired > 0 || pendingRejected > 0) {
    console.log(
      `✅ Expired ${shiftsExpired} unfilled shift(s), rejected ${pendingRejected} stale pending application(s)`,
    );
  }

  return shiftsExpired;
}

export async function runRecomputeStuckShifts() {
  const now = new Date();
  const BATCH_SIZE = 200;

  // Only shifts that started and are still in a non-terminal state
  const stuck = await Shift.find({
    status: { $in: ["open", "filled"] },
    startTime: { $lt: now },
  })
    .select("_id")
    .limit(BATCH_SIZE)
    .lean();

  if (stuck.length === 0) return 0;

  let recomputed = 0;
  for (const s of stuck) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // re-check inside transaction — the shift may have been touched
        // between the find above and now
        const fresh = await Shift.findById(s._id).session(session);
        if (!fresh || ["cancelled", "completed", "expired"].includes(fresh.status)) {
          return;
        }
        await recomputeShiftStatus(s._id, session);
        recomputed++;
      });
    } catch (err) {
      logError(`recomputeStuckShifts failed for ${s._id}:`, err);
    } finally {
      session.endSession();
    }
  }

  if (recomputed > 0) {
    console.log(`✅ Recomputed ${recomputed} stuck shift(s)`);
  }
  return recomputed;
}