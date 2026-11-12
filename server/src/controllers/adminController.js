// server/src/controllers/adminController.js
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import Shift from "../models/Shift.js";
import Application from "../models/Application.js";
import ShiftRecord from "../models/ShiftRecord.js";
import Dispute from "../models/Dispute.js";
import cloudinary from "../config/cloudinary.js";
import Employer from "../models/Employer.js";
import redisClient from "../config/redis.js";
import { adjustWallet } from "../services/walletService.js";
import { HttpError } from "../utils/HttpError.js";
import { safeEmit, broadcastToRole } from "../utils/notify.js";
import {
  settleDispute,
  emitDisputeResolved,
} from "../services/disputeService.js";
import { enforceBan } from "../services/banService.js";
import { logAdminAction } from "../utils/audit.js";
import { logSecurityEvent } from "../utils/securityAudit.js";
import { disconnectUserSockets } from "../utils/sessions.js";
import { verifyCurrentPassword } from "../services/payoutVerification.js";
import LedgerCheck from "../models/LedgerCheck.js";
import { runLedgerCheck } from "../services/ledgerService.js";
import PlatformWallet from "../models/PlatformWallet.js";


import { logError } from "../utils/logger.js";
export async function getLedgerChecks(req, res) {
  try {
    const checks = await LedgerCheck.find()
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.locals.rawMoney = true;
    res.json(checks);
  } catch (err) {
    logError("adminController:38", err);
    res.status(500).json({ error: "Failed to load ledger checks" });
  }
}

export async function runLedgerNow(req, res) {
  try {
    const report = await runLedgerCheck();
    res.locals.rawMoney = true;
    res.json(report);
  } catch (err) {
    logError("adminController:49", err);
    res.status(500).json({ error: "Ledger check failed to run" });
  }
}
// Defaults are generous so today's admin UI keeps working; add real paging in the UI later.
function pageParams(req) {
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 100, 1),
    200,
  );
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { limit, skip: (page - 1) * limit };
}

export async function getPendingVerifications(req, res) {
  try {
    const { limit, skip } = pageParams(req);
    const filter = { verificationStatus: "pending" };

    if (req.query.role && ["worker", "employer"].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    if (req.query.q && typeof req.query.q === "string") {
      const term = req.query.q.trim().slice(0, 80);
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
        ];
      }
    }

    const [pendingUsers, total] = await Promise.all([
      User.find(filter)
        .select("name email phone role verificationStatus businessName")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: pendingUsers,
      total,
      page: Math.max(parseInt(req.query.page, 10) || 1, 1),
      limit,
      hasMore: skip + pendingUsers.length < total,
    });
  } catch (err) {
    logError("getPendingVerifications failed:", err);
    res.status(500).json({ error: "Failed to fetch pending verifications" });
  }
}

export async function getAllUsers(req, res) {
  try {
    const { limit, skip } = pageParams(req);
    const filter = {
      verificationStatus: { $ne: "pending" },
      role: { $ne: "admin" },
    };

    if (req.query.role && ["worker", "employer"].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    if (req.query.status === "blocked") {
      filter.isActive = false;
    } else if (req.query.status === "banned") {
      filter.isBanned = true;
    } else if (req.query.status === "strike") {
      filter.strikes = { $gt: 0 };
    }

    if (req.query.q && typeof req.query.q === "string") {
      const term = req.query.q.trim().slice(0, 80);
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
          { phone: { $regex: escaped, $options: "i" } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email phone role isActive isBanned strikes createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const employerIds = users.filter((u) => u.role === "employer").map((u) => u._id);
    if (employerIds.length > 0) {
      const employers = await Employer.find({ user: { $in: employerIds } })
        .select("user businessName")
        .lean();
      const names = new Map(employers.map((e) => [String(e.user), e.businessName]));
      for (const u of users) {
        if (u.role === "employer") u.businessName = names.get(String(u._id)) ?? null;
      }
    }

    res.json({
      users,
      total,
      page: Math.max(parseInt(req.query.page, 10) || 1, 1),
      limit,
      hasMore: skip + users.length < total,
    });
  } catch (err) {
    logError("getAllUsers failed:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function getVerificationDocUrl(req, res) {
  try {
    const user = await User.findById(req.params.id).select("+verificationDocPublicId");
    if (!user || !user.verificationDocPublicId) {
      return res
        .status(404)
        .json({ error: "No verification document on file" });
    }

    // Generates a signed, working URL for an "authenticated" resource,
    // fresh, every single call — never stored anywhere.
    const signedUrl = cloudinary.url(user.verificationDocPublicId, {
      type: "authenticated",
      resource_type: "image",
      sign_url: true,
    });

    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate document URL" });
  }
}

export async function verifyUser(req, res) {
  try {
    const { decision } = req.body;

    if (!["verified", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision status" });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, verificationStatus: "pending" },
      { verificationStatus: decision },
      { returnDocument: "after" },
    );
    if (!user) {
      const exists = await User.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        error: exists
          ? "This user has already been reviewed"
          : "User not found",
      });
    }
    logAdminAction(req, "verify_user", "User", user._id, { decision });

    // 🔔 Real-time notify the user
    safeEmit(user._id, "user:verified", {
      verificationStatus: user.verificationStatus,
      decision,
      name: user.name,
    });

    res.json({ verificationStatus: user.verificationStatus });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status" });
  }
}

export async function toggleBlockUser(req, res) {
  try {
    const current = await User.findById(req.params.id).select(
      "isActive isBanned",
    );
    if (!current) return res.status(404).json({ error: "User not found" });

    // A user is blocked if EITHER flag says so (strike bans only set isBanned).
    const isBlocked = current.isBanned || current.isActive === false;
    const willBlock = !isBlocked;

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      willBlock
        ? {
            isActive: false,
            isBanned: true,
            bannedAt: new Date(),
            banReason: "Blocked by administrator",
            banEnforcedAt: null,
          }
        : {
            isActive: true,
            isBanned: false,
            bannedAt: null,
            banReason: null,
            banEnforcedAt: null,
            tokenRevokedAt: null, // 🆕 allow next ban to revoke tokens again
            strikes: 0,
          },
      { returnDocument: "after" },
    );

    if (willBlock)
      enforceBan(updated._id).catch((err) =>
        logError("enforceBan failed:", err),
      );

    await logAdminAction(
      req,
      willBlock ? "block_user" : "unblock_user",
      "User",
      updated._id,
    );

    res.json({ isActive: updated.isActive, isBanned: updated.isBanned });
  } catch (err) {
    logError("adminController:278", err);
    res.status(500).json({ error: "Failed to toggle block status" });
  }
}

// ✅ NEW: Explicit unban — clears strikes + isBanned + isActive
export async function unbanUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive: true,
        isBanned: false,
        bannedAt: null,
        banReason: null,
        banEnforcedAt: null,
        tokenRevokedAt: null,
        strikes: 0,
      },
      { returnDocument: "after" },
    ).select("isActive isBanned strikes");

    await logAdminAction(req, "unban_user", "User", updated._id, {
      previousStrikes: user.strikes,
      wasBanned: user.isBanned,
    });

    res.json({
      message: "User unbanned successfully. Strikes reset to 0.",
      user: updated,
    });
  } catch (err) {
    logError("unbanUser failed:", err);
    res.status(500).json({ error: "Failed to unban user" });
  }
}

// ✅ NEW: Reset only strikes — does NOT unban
export async function resetStrikes(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const previousStrikes = user.strikes;
     const wasBanned = user.isBanned; 

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { strikes: 0 },
      { returnDocument: "after" },
    ).select("strikes isBanned");

    // If strikes were the only reason for ban (no isActive=false), auto-unban
    if (updated.isBanned && user.isActive !== false) {
      const stillBanned = await User.findByIdAndUpdate(
        req.params.id,
        {
          isBanned: false,
          bannedAt: null,
          banReason: null,
          banEnforcedAt: null,
          tokenRevokedAt: null,
        },
        { returnDocument: "after" },
      ).select("strikes isBanned");
      updated.isBanned = stillBanned.isBanned;
    }

    await logAdminAction(req, "reset_strikes", "User", updated._id, {
      previousStrikes,
    });

    if (!wasBanned) {
      safeEmit(updated._id, "user:updated", { strikes: 0 });
    }

    res.json({
      message: `Strikes reset from ${previousStrikes} to 0.`,
      user: updated,
    });
  } catch (err) {
    logError("resetStrikes failed:", err);
    res.status(500).json({ error: "Failed to reset strikes" });
  }
}

const forceLogoutSchema = z.object({
  password: z.string().min(1, { message: "Enter your password to confirm" }).max(128),
  reason: z.string().trim().max(200).optional(),
});

export async function forceLogoutUser(req, res) {
  const parsed = forceLogoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  const { password, reason } = parsed.data;
  const targetId = req.params.id;

  try {
    if (String(req.user._id) === targetId) {
      return res.status(400).json({ error: "Use Log out to end your own session", code: "SELF_TARGET" });
    }

    // Re-authentication: prove the person at the keyboard knows the ADMIN password.
    if (!(await verifyCurrentPassword(req.user._id, password))) {
      await logSecurityEvent(req, req.user._id, "admin_reauth_failed", { action: "force_logout", targetId });
      return res.status(400).json({ error: "Password is incorrect", code: "WRONG_PASSWORD" });
    }

    const target = await User.findById(targetId).select("name role");
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "admin") {
      return res.status(403).json({ error: "Admin accounts can't be force-logged-out from here", code: "TARGET_IS_ADMIN" });
    }

    // 1) Revoke: every token issued so far now carries an old `tv`.
    await User.updateOne({ _id: target._id }, { $inc: { tokenVersion: 1 } });
    // 2) Kick live sockets (they authenticate once, at handshake).
    await disconnectUserSockets(target._id);

    // 3) Audit trail.
    await logAdminAction(req, "force_logout", "User", target._id, {
      ip: req.ip,
      userAgent: req.get("user-agent")?.slice(0, 200),
      targetRole: target.role,
      reason: reason || null,
    });
    await logSecurityEvent(null, target._id, "force_logout", { byAdmin: String(req.user._id) });

    res.json({ loggedOut: true, userId: String(target._id), message: `${target.name} was signed out of every device.` });
  } catch (err) {
    logError("forceLogoutUser failed:", err);
    res.status(500).json({ error: "Failed to force logout" });
  }
}

const SHIFT_STATUSES = ["open", "filled", "completed", "cancelled", "expired"];
export async function getAllShifts(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && SHIFT_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.q && typeof req.query.q === "string") {
      const term = req.query.q.trim().slice(0, 80);
      if (term) {
        // Escape regex special chars so user input can't DoS the query
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.title = { $regex: escaped, $options: "i" };
      }
    }

    const [shifts, total] = await Promise.all([
      Shift.find(filter)
        .populate("employer", "businessName user")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Shift.countDocuments(filter),
    ]);

    res.json({
      shifts,
      total,
      page,
      limit,
      hasMore: skip + shifts.length < total,
    });
  } catch (err) {
    logError("getAllShifts failed:", err);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
}

export async function getAnalytics(req, res) {
  const cacheKey = "admin:analytics";
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  try {
    const [
      totalWorkers,
      totalEmployers,
      shiftCounts,
      totalApplications,
      paidAgg,
      disputeCounts,
    ] = await Promise.all([
      User.countDocuments({ role: "worker", verificationStatus: "verified" }),
      User.countDocuments({ role: "employer", verificationStatus: "verified" }),
      Shift.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]), // Returns [{_id: "open", count: 5}]
      Application.countDocuments({}),
      ShiftRecord.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: null,
            totalPaidOut: { $sum: "$amountEarned" },
            count: { $sum: 1 },
          },
        },
      ]),
      Dispute.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const paid = paidAgg[0] ?? { totalPaidOut: 0, count: 0 };

    const result = {
      // 1. Manually build the users array for the first chart
      usersByRole: [
        { _id: "worker", count: totalWorkers },
        { _id: "employer", count: totalEmployers },
      ],
      // 2. Send the raw aggregation array directly for the second chart (no forEach needed!)
      shiftsByStatus: shiftCounts,

      totalApplications,

      // 3. Rename this to match exactly what the frontend is looking for
      totalShiftsWorked: paid.count,

      totalPaidOut: paid.totalPaidOut,

      // Keep disputes as an array too, in case you want to chart them later!
      disputesByStatus: disputeCounts,
    };

    // Send the response in the EXACT format the frontend expects
    await redisClient
      .setEx(cacheKey, 60, JSON.stringify(result))
      .catch(() => {});
    res.json(result);
  } catch (err) {
    logError("adminController:522", err);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
}

export async function getPlatformWallet(req, res) {
  try {
    const wallet = await PlatformWallet.findById("platform").lean();
    const shiftsCount = await Shift.countDocuments({});
    res.locals.rawMoney = true;
    res.json({
      balance: wallet?.balance ?? 0, // in paise
      shiftsPosted: shiftsCount,
    });
  } catch (err) {
    logError("adminController:537", err);
    res.status(500).json({ error: "Failed to load platform wallet" });
  }
}

export async function getDisputes(req, res) {
  try {
    const { limit, skip } = pageParams(req);
    const filter = {};
    if (req.query.status !== undefined) {
      const status = req.query.status;
      if (
        typeof status !== "string" ||
        !Dispute.schema.path("status").enumValues.includes(status)
      ) {
        return res.status(400).json({ error: "Invalid status filter" });
      }
      filter.status = status;
    }

    if (req.query.q && typeof req.query.q === "string") {
      const term = req.query.q.trim().slice(0, 80);
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.reason = { $regex: escaped, $options: "i" };
      }
    }

    const [disputes, total] = await Promise.all([
      Dispute.find(filter)
        .populate("worker", "name email")
        .populate("employer", "name email")
        .populate("shift", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dispute.countDocuments(filter),
    ]);

    res.json({
      disputes,
      total,
      page: Math.max(parseInt(req.query.page, 10) || 1, 1),
      limit,
      hasMore: skip + disputes.length < total,
    });
  } catch (err) {
    logError("getDisputes failed:", err);
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
}

const ruleDisputeSchema = z.object({
  ruledFor: z.enum(["worker", "employer"]),
  resolution: z.string().min(5, "A resolution note is required").max(1000),
});

export async function resolveDispute(req, res) {
  const parsed = ruleDisputeSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });

  const session = await mongoose.startSession();
  let dispute;
  try {
    await session.withTransaction(async () => {
      const existing = await Dispute.findById(req.params.id).session(session);
      if (!existing) throw new HttpError(404, "Dispute not found");
      if (!["awaiting_proof", "under_review"].includes(existing.status)) {
        throw new HttpError(409, "This dispute is already resolved");
      }

      const shiftRecord = await ShiftRecord.findById(
        existing.shiftRecord,
      ).session(session);
      const application = await Application.findById(
        existing.application,
      ).session(session);
      const shift = await Shift.findById(existing.shift)
        .populate("employer")
        .session(session);
      if (!shiftRecord || !application || !shift) {
        throw new HttpError(
          404,
          "Underlying shift data for this dispute is missing",
        );
      }

      dispute = await settleDispute({
        dispute: existing,
        shiftRecord,
        application,
        shift,
        ruledFor: parsed.data.ruledFor,
        ruledBy: req.user._id,
        resolution: parsed.data.resolution,
        autoResolved: false,
        session,
      });
    });

    emitDisputeResolved(dispute);

const loserUserId = parsed.data.ruledFor === "worker" ? dispute.employer : dispute.worker;
const loser = await User.findById(loserUserId).select("isBanned");
if (loser?.isBanned) {
  enforceBan(loserUserId).catch((err) =>
    logError("enforceBan failed:", err)
  );
}

    res.json({ dispute });
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    logError("adminController:653", err);
    res.status(500).json({ error: "Failed to resolve dispute" });
  } finally {
    session.endSession();
  }
}

// Add to the bottom of server/src/controllers/adminController.js

export async function cancelShift(req, res) {
  const session = await mongoose.startSession();
  let updatedShift;
  let refundedCount = 0;
  let refundedTotal = 0;           // 🆕
  let workerIdsToNotify = [];
  let pendingWorkerIds = [];       // 🆕

  try {
    await session.withTransaction(async () => {
      workerIdsToNotify = [];
      pendingWorkerIds = [];        // 🆕
      refundedCount = 0;
      refundedTotal = 0;            // 🆕
      
      // 1. Fetch shift... (unchanged)
      const shift = await Shift.findById(req.params.id)
        .populate("employer")
        .session(session);
      
      if (!shift) throw new HttpError(404, "Shift not found");
      if (shift.status === "cancelled")
        throw new HttpError(400, "Shift is already cancelled");
      
      // 2. Active records check (unchanged)
      const activeRecords = await ShiftRecord.find({
        shift: shift._id,
        status: { $in: ["ongoing", "pending_resolution", "disputed"] },
      }).session(session);
      
      if (activeRecords.length > 0) {
        throw new HttpError(409, "Cannot cancel shift: there are active workers, pending resolutions, or open disputes. Resolve those first.");
      }
      
      // 3. Locked (accepted) applications (unchanged)
      const lockedApplications = await Application.find({
        shift: shift._id,
        escrowStatus: "locked",
      }).session(session);
      
      // 4. Process refunds (unchanged, + refundedTotal)
      for (const app of lockedApplications) {
        await adjustWallet({
          userId: shift.employer.user,
          delta: app.escrowAmount,
          type: "escrow_refund",
          amount: app.escrowAmount,
          shift: shift._id,
          application: app._id,
          session,
        });
        
        app.status = "cancelled_by_admin";
        app.cancellationReason = "Cancelled by platform administrator";
        app.escrowStatus = "released";
        app.escrowReleasedAt = new Date();
        await app.save({ session });
        
        workerIdsToNotify.push(app.worker);
        refundedCount++;
        refundedTotal += app.escrowAmount;   // 🆕
      }
      shift.acceptedCount = 0;
      
      // 🆕 5a. Capture pending workers BEFORE updateMany
      const pendingApps = await Application.find({
        shift: shift._id,
        status: "pending",
      }).select("worker").session(session);
      pendingWorkerIds = pendingApps.map((a) => a.worker);
      
      // 5b. Reject pending apps (unchanged)
      await Application.updateMany(
        { shift: shift._id, status: "pending" },
        { $set: { status: "rejected", message: "Shift cancelled by administrator" } },
        { session },
      );
      
      // 6. Cancel shift (unchanged)
      shift.status = "cancelled";
      updatedShift = await shift.save({ session });
    });
    
    await logAdminAction(req, "cancel_shift", "Shift", req.params.id, {
      refundedCount,
    });
    
    // ─── NOTIFICATIONS (post-commit) ───
    
    // Accepted workers (existing)
    workerIdsToNotify.forEach((workerId) => {
      safeEmit(workerId, "shift:cancelled_by_admin", {
        shiftId: req.params.id,
        note: "This shift was cancelled by a platform administrator.",
      });
    });
    
    // 🆕 Pending workers — same event, different note
    pendingWorkerIds.forEach((workerId) => {
      safeEmit(workerId, "shift:cancelled_by_admin", {
        shiftId: req.params.id,
        note: "A shift you applied to was cancelled by an administrator.",
      });
    });
    
    // Employer (existing)
    if (updatedShift?.employer?.user) {
      safeEmit(updatedShift.employer.user, "shift:cancelled_by_admin", {
        shiftId: req.params.id,
        note: "Your shift was cancelled by a platform administrator.",
      });
    }
    
    // Admin (existing)
    broadcastToRole("admin", "shifts:changed", {
      shiftId: req.params.id,
      reason: "admin_cancelled",
    });
    
    // 🆕 Better message with refund amount
    res.json({
      message: refundedTotal > 0
        ? `Shift cancelled. ₹${(refundedTotal / 100).toFixed(2)} refunded to your wallet.`
        : "Shift cancelled successfully.",
      refundedCount,
      refundedTotal,
      shift: updatedShift,
    });
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    logError("Admin shift cancellation failed:", err);
    res.status(500).json({ error: "Failed to cancel shift" });
  } finally {
    session.endSession();
  }
}

export async function deleteShift(req, res) {
  try {
    const [appCount, recordCount] = await Promise.all([
      Application.countDocuments({ shift: req.params.id }),
      ShiftRecord.countDocuments({ shift: req.params.id }),
    ]);
    if (appCount > 0 || recordCount > 0) {
      return res.status(409).json({
        error:
          "This shift has applications or records. Cancel it instead of deleting.",
      });
    }

    const shift = await Shift.findByIdAndDelete(req.params.id);
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    await logAdminAction(req, "delete_shift", "Shift", req.params.id);
      broadcastToRole("admin", "shifts:changed", {
      shiftId: req.params.id,
      reason: "admin_deleted",
    });
    res.json({ success: true, shiftId: req.params.id });
  } catch (err) {
    logError("adminController:822", err);
    res.status(500).json({ error: "Failed to delete shift" });
  }
}

// --- FULL USER PROFILE & TRUST STATS ---
export async function getFullUserProfile(req, res) {
  try {
     const user = await User.findById(req.params.id).select(
      // ✅ Explicit allow-list — only fields admins actually need
      "name email phone role avatarUrl verificationStatus " +
      "isActive isBanned strikes bannedAt banReason " +
      "walletBalance freeShiftsUsed createdAt " +
      "businessName"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    let stats = {};

    if (user.role === "employer") {
      const employer = await Employer.findOne({ user: user._id })
        .select("_id")
        .lean();
      const rows = employer
        ? await Shift.aggregate([
            { $match: { employer: employer._id } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
        : [];
      const by = Object.fromEntries(rows.map((r) => [r._id, r.count]));
      stats = {
        totalPosted: rows.reduce((sum, r) => sum + r.count, 0),
        active: by.open || 0,
        cancelled: by.cancelled || 0,
        completed: by.completed || 0,
      };
    } else if (user.role === "worker") {
      const [appRows, paid] = await Promise.all([
        Application.aggregate([
          { $match: { worker: user._id } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        ShiftRecord.aggregate([
          { $match: { worker: user._id, status: "completed" } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amountEarned" },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);
      const by = Object.fromEntries(appRows.map((r) => [r._id, r.count]));
      stats = {
        totalApplied: appRows.reduce((sum, r) => sum + r.count, 0),
        accepted: by.accepted || 0,
        completedShifts: paid[0]?.count ?? 0,
        totalEarned: paid[0]?.total ?? 0,
      };
    }

    res.json({ user, stats });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

const walletActionSchema = z.object({
  action: z.enum(["forfeit", "refunded_offline"]),
  password: z.string().min(1, "Admin password is required"),
  reason: z.string().trim().min(5).max(200),
});

// POST /api/admin/users/:id/wallet-action
export async function handleBannedWalletAction(req, res) {
  const parsed = walletActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { action, password, reason } = parsed.data;
  const targetId = req.params.id;

  try {
    // 1. Re-authenticate Admin
    if (!(await verifyCurrentPassword(req.user._id, password))) {
      return res.status(400).json({ error: "Password is incorrect", code: "WRONG_PASSWORD" });
    }

    // 2. Fetch user and check balance
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    
    // Sirf banned ya blocked users ke liye allow karo
    if (!targetUser.isBanned && targetUser.isActive !== false) {
      return res.status(400).json({ error: "User is not banned or blocked" });
    }

    let balanceToClear = targetUser.walletBalance || 0;
    if (balanceToClear <= 0) {
      return res.status(400).json({ error: "User has no wallet balance to clear" });
    }

    // 3. Process the action
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Re-read the balance INSIDE the transaction: it may have changed since
        // the check above (payout reversal, refund, concurrent action).
        const fresh = await User.findById(targetUser._id)
          .select("walletBalance")
          .session(session);
        balanceToClear = fresh?.walletBalance || 0;
        if (balanceToClear <= 0) {
          throw new HttpError(400, "User has no wallet balance to clear");
        }

        // Deduct money from user's wallet
        await adjustWallet({
          userId: targetUser._id,
          delta: -balanceToClear, // Negative amount
          type: action === "forfeit" ? "admin_forfeit" : "admin_manual_refund",
          amount: balanceToClear,
          session,
        });

        // If forfeited, add to platform wallet
        if (action === "forfeit") {
          await PlatformWallet.findByIdAndUpdate(
            "platform",
            { $inc: { balance: balanceToClear } },
            { session, upsert: true }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // 4. Audit Logs
    await logAdminAction(req, `wallet_${action}`, "User", targetUser._id, {
      amount: balanceToClear,
      reason,
    });
    await logSecurityEvent(null, targetUser._id, action === "forfeit" ? "wallet_forfeited" : "wallet_refunded_offline", {
      byAdmin: String(req.user._id),
      amount: balanceToClear,
      reason,
    });

    res.json({ 
      message: `Balance of ₹${(balanceToClear / 100).toFixed(2)} was successfully ${action === "forfeit" ? "forfeited to platform" : "marked as refunded"}.`,
      newBalance: 0 
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    logError("handleBannedWalletAction failed:", err);
    res.status(500).json({ error: "Failed to process wallet action" });
  }
}
