// server/src/services/banService.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Employer from "../models/Employer.js";
import Shift from "../models/Shift.js";
import Application from "../models/Application.js";
import ShiftRecord from "../models/ShiftRecord.js";
import {
  cancelByWorkerFault,
  cancelByEmployer,
  reopenShiftIfNeeded,
} from "./cancellationService.js";
import { getIO } from "../config/socket.js";
import { safeEmit } from "../utils/notify.js";

import { logError } from "../utils/logger.js";
async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    session.endSession();
  }
}

// Returns the number of items that failed, so the caller knows whether to retry later.
async function enforceWorkerBan(userId) {
  let failed = 0;
  await Worker.updateOne({ user: userId }, { $set: { isAvailable: false } });
  
  // 👇 1. Worker ka naam fetch karein taaki toast message sahi ho
  const workerUser = await User.findById(userId).select("name").lean();
  const workerName = workerUser?.name || "A worker";

  // 👇 2. Pending applications fetch karein update se PEHLE
  const pendingApps = await Application.find({ worker: userId, status: "pending" })
    .populate({ path: "shift", select: "title employer", populate: { path: "employer", select: "user" } })
    .lean();
  
  await Application.updateMany(
    { worker: userId, status: "pending" },
    { $set: { status: "withdrawn", message: "Applicant is no longer available" } },
  );

   // 👇 3. Har pending application ke employer ko event bhejein
  for (const app of pendingApps) {
    if (app.shift?.employer?.user) {
      safeEmit(app.shift.employer.user, "application:withdrawn", {
        shiftId: app.shift._id,
        shiftTitle: app.shift.title,
        workerName: workerName,
        applicationId: app._id,
      });
    }
  }

  const accepted = await Application.find({ worker: userId, status: "accepted" })
    .select("_id shift")
    .lean();

  for (const a of accepted) {
    try {
      const employerUserId = await runInTransaction(async (session) => {
        const application = await Application.findOne({ _id: a._id, status: "accepted" }).session(session);
        if (!application) return null;
        const shift = await Shift.findById(application.shift).populate("employer").session(session);
        if (!shift) return null;

        await cancelByWorkerFault({
          application,
          employerUserId: shift.employer.user,
          workerUserId: userId,
          reason: "Worker account was banned",
          noShow: false,
          applyStrikeToWorker: false, // already banned, don't stack strikes
          session,
        });
        await reopenShiftIfNeeded(shift, session);
        return shift.employer.user;
      });
      if (employerUserId) {
        safeEmit(employerUserId, "shift:worker_removed", { shiftId: a.shift, applicationId: a._id });
      }
    } catch (err) {
      failed++;
      logError(`enforceWorkerBan: application ${a._id} failed:`, err);
    }
  }
  return failed;
}

async function enforceEmployerBan(userId) {
  let failed = 0;
  const employer = await Employer.findOne({ user: userId }).select("_id").lean();
  if (!employer) return 0;

  const shifts = await Shift.find({ employer: employer._id, status: { $in: ["open", "filled"] } })
    .select("_id")
    .lean();

  for (const s of shifts) {
    try {
      const notifications = await runInTransaction(async (session) => {
        const shift = await Shift.findById(s._id).populate("employer").session(session);
        if (!shift || !["open", "filled"].includes(shift.status)) return [];

        const notify = [];
        const accepted = await Application.find({ shift: shift._id, status: "accepted" }).session(session);
        for (const application of accepted) {
          // Same refund/penalty rules as a normal employer cancellation.
          const r = await cancelByEmployer({
            application,
            employerUserId: userId,
            workerUserId: application.worker,
            reason: "Employer account was banned",
            session,
          });
          notify.push({ workerId: application.worker, penalty: r.penaltyToWorker });
        }
        await Application.updateMany(
          { shift: shift._id, status: "pending" },
          { $set: { status: "rejected" } },
          { session },
        );

        // A shift where someone already clocked in stays alive so they can be paid.
        const started = await ShiftRecord.exists({ shift: shift._id }).session(session);
        if (!started) {
          shift.status = "cancelled";
          await shift.save({ session });
        }
        return notify;
      });
      notifications.forEach(({ workerId, penalty }) =>
        safeEmit(workerId, "shift:cancelled_by_employer", { shiftId: s._id, penaltyPaidToYou: penalty }),
      );
    } catch (err) {
      failed++;
      logError(`enforceEmployerBan: shift ${s._id} failed:`, err);
    }
  }
  return failed;
}

// Safe to call any number of times.
export async function enforceBan(userId) {
  // 🆕 Fetch tokenRevokedAt too — that's the real idempotency marker
  const user = await User.findById(userId).select(
    "role isBanned banEnforcedAt tokenRevokedAt"
  );
  if (!user || !user.isBanned) return;

  // 🆕 Revoke all sessions ONCE per ban event.
  // The cron retries cleanup until it succeeds, but tokenVersion must only
  // increment once per ban — otherwise each retry keeps bumping it.
  // tokenRevokedAt is the marker that survives failed cleanup.
  if (!user.tokenRevokedAt) {
    await User.updateOne(
      { _id: userId },
      { $inc: { tokenVersion: 1 }, $set: { tokenRevokedAt: new Date() } }
    );
  }

  try {
    getIO().in(`user:${userId}`).disconnectSockets(true);
  } catch (err) {
    logError("enforceBan: socket disconnect failed:", err);
  }

  let failed = 0;
  if (user.role === "worker") failed = await enforceWorkerBan(userId);
  else if (user.role === "employer") failed = await enforceEmployerBan(userId);

  // Only mark it done if everything worked; otherwise the cron retries.
  // Retries are now safe — tokenRevokedAt prevents a second increment.
  if (failed === 0) {
    await User.updateOne({ _id: userId, isBanned: true }, { banEnforcedAt: new Date() });
  }
}