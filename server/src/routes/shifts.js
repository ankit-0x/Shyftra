import express from "express";
import mongoose from "mongoose";
import { chargePlatformFee } from "../services/escrowService.js";
import { InsufficientFundsError } from "../services/walletService.js";
import { HttpError } from "../utils/HttpError.js";
import { distanceMeters } from "../utils/geo.js";
import {
  PLATFORM_FEE_FLAT,
  NO_SHOW_GRACE_MINUTES,
  CLOCK_IN_EARLY_MINUTES,
  ARRIVAL_RADIUS_METERS,
  FREE_SHIFTS_LIMIT,
} from "../config/businessRules.js";
import { lockEscrow } from "../services/escrowService.js";
import Shift from "../models/Shift.js";
import { startOfMonthIST } from "../utils/istTime.js";
import Employer from "../models/Employer.js";
import Worker from "../models/Worker.js";
import redisClient from "../config/redis.js";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { isWorker, isEmployer } from "../middleware/roles.js";
import Application from "../models/Application.js";
import ShiftRecord from "../models/ShiftRecord.js";
import Transaction from "../models/Transaction.js";
import Dispute from "../models/Dispute.js";
import { createOtp, verifyAndConsumeOtp } from "../utils/otp.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import { recomputeAverageRating } from "../utils/ratings.js";
import {
  otpRequestLimiter,
  browseLimiter,
} from "../middleware/rateLimiters.js";
import {
  cancelByWorkerFault,
  cancelByEmployer,
  reopenShiftIfNeeded,
  getWorkerCancelOutcome, // ✅ NEW
} from "../services/cancellationService.js";
import { BAN_THRESHOLD } from "../services/strikeServices.js"; // ✅ NEW
import {
  computeSettlementSplit,
  finalizeSettlement,
} from "../services/settlementService.js";
import { requireVerified } from "../middleware/roles.js";
import { safeEmit, broadcastToRole } from "../utils/notify.js";
import { getIO } from "../config/socket.js";
import { enforceBan } from "../services/banService.js";
import { recomputeShiftStatus } from "../services/shiftStatusService.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

const CONTACT_VISIBLE_STATUSES = [
  "accepted",
  "in_progress",
  "pending_resolution",
  "disputed",
  "completed",
];

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_SHIFT_HOURS = 16;

router.param("id", (req, res, next, value) => {
  if (!OBJECT_ID.test(value))
    return res.status(404).json({ error: "Not found" });
  next();
});
router.param("appId", (req, res, next, value) => {
  if (!OBJECT_ID.test(value))
    return res.status(404).json({ error: "Not found" });
  next();
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

// ✅ NEW: hourlyPay is now in PAISE. max = ₹1,00,000 = 10,000,000 paise.
const shiftWriteBaseSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  skillRequired: z
    .array(z.string().min(2).max(60))
    .min(1, "Select at least one skill"),
  hourlyPay: z.number().int().min(100).max(10_000_000), // paise
  workersNeeded: z.coerce.number().int().positive().max(50),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  address: z.string().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const shiftCreateSchema = shiftWriteBaseSchema
  .extend({
    workersNeeded: z.coerce.number().int().positive().max(50).default(1), // 👈 यहाँ वापस जोड़ दिया
  })
  // (0,0) is "Null Island" in the Atlantic: what a broken client sends when it has no real position.
  .refine((d) => !(d.lat === 0 && d.lng === 0), {
    message: "Choose the work site on the map",
    path: ["lat"],
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .refine((d) => d.startTime > new Date(), {
    message: "startTime must be in the future",
    path: ["startTime"],
  })
  .refine((d) => d.endTime - d.startTime <= MAX_SHIFT_HOURS * 3600000, {
    message: `A shift can't be longer than ${MAX_SHIFT_HOURS} hours`,
    path: ["endTime"],
  });

const shiftUpdateSchema = shiftWriteBaseSchema
  .partial()
  .refine(
    (d) =>
      (d.lat === undefined) === (d.lng === undefined) &&
      !(d.lat === 0 && d.lng === 0),
    {
      message: "Send lat and lng together, and choose a real work site",
      path: ["lat"],
    },
  );

const applicationStatusSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

const applySchema = z.object({
  message: z.string().max(500).optional(),
});

const clockInSchema = z.object({
  otp: z.string().length(6),
});

// ✅ NEW: minPay is now expected in PAISE (frontend sends paise).
const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50).default(10),
  skill: z.string().trim().min(1).max(60).optional(),
  minPay: z.coerce.number().int().min(0).max(10_000_000).optional(), // paise
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  _r: z.coerce.number().optional(),
});

const clockOutSchema = z.object({
  workerId: z.string().regex(OBJECT_ID, "Invalid workerId"),
  otp: z.string().length(6),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  revieweeId: z.string().regex(OBJECT_ID).optional(),
});

const forceClockOutSchema = z.object({ exitTime: z.string().optional() });

const arrivedSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

async function invalidateNearbyCache() {
  try {
    const keysToDelete = [];

    for await (const key of redisClient.scanIterator({
      MATCH: "shifts:nearby:*",
      COUNT: 100,
    })) {
      if (Array.isArray(key)) {
        keysToDelete.push(...key);
      } else if (typeof key === "string" && key.length > 0) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }
  } catch (err) {
    logError("Failed to clear nearby cache:", err);
  }
}

// =========================================================
// ROOT / EXACT MATCH ROUTES
// =========================================================

router.post("/", requireAuth, isEmployer, async (req, res) => {
  const parsed = shiftCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const {
    title,
    description,
    skillRequired,
    hourlyPay,
    workersNeeded,
    startTime,
    endTime,
    address,
    lat,
    lng,
  } = parsed.data;

  const session = await mongoose.startSession();
  let shift;

  try {
    await session.withTransaction(async () => {
      const employer = await Employer.findOne({ user: req.user._id }).session(
        session,
      );
      if (!employer) throw new HttpError(404, "Employer profile not found");

      // Atomically claim one free slot. Two parallel requests cannot both
      // claim the last slot: the second one hits a write conflict, retries,
      // and then finds the counter already at the limit.
      const hasFreeSlot =
        FREE_SHIFTS_LIMIT > 0
          ? {
              $or: [
                { freeShiftsUsed: { $lt: FREE_SHIFTS_LIMIT } },
                { freeShiftsUsed: { $exists: false } },
              ],
            }
          : { freeShiftsUsed: { $lt: 0 } }; // limit 0 -> never free
      const claimed = await User.findOneAndUpdate(
        { _id: req.user._id, ...hasFreeSlot },
        { $inc: { freeShiftsUsed: 1 } },
        { session },
      );
      const isFreebie = claimed !== null;

      // Unverified users may only post while free slots remain.
      if (!isFreebie && req.user.verificationStatus !== "verified") {
        const verifyErr = new HttpError(
          403,
          `You've used your ${FREE_SHIFTS_LIMIT} free shift posts. Verify your account to post more.`,
        );
        verifyErr.extra = {
          requiresVerification: true,
          freeShiftsUsed: FREE_SHIFTS_LIMIT,
        };
        throw verifyErr;
      }

      const [created] = await Shift.create(
        [
          {
            title,
            description,
            skillRequired,
            hourlyPay,
            workersNeeded,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            address,
            location: { type: "Point", coordinates: [lng, lat] },
            employer: employer._id,
            status: "open",
            platformFee: isFreebie ? 0 : PLATFORM_FEE_FLAT,
            isFreebie,
          },
        ],
        { session },
      );
      shift = created;

      // ✅ Only charge fee if NOT freebie
      if (!isFreebie) {
        await chargePlatformFee({
          employerUserId: req.user._id,
          shiftId: shift._id,
          session,
        });
      }

      await Employer.updateOne(
        { _id: employer._id },
        { $inc: { shiftsPosted: 1 } },
        { session },
      );
    });

    await invalidateNearbyCache();

    broadcastToRole("worker", "shifts:changed", {
      shiftId: shift._id,
      reason: "posted",
    });
    safeEmit(req.user._id, "shifts:changed", {
      shiftId: shift._id,
      reason: "posted",
    });
    getIO()
      .to("public:feed")
      .emit("shifts:changed", { shiftId: shift._id, reason: "posted" });

    res.status(201).json({ shift });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(400).json({
        error: `Insufficient wallet balance to cover the ₹${PLATFORM_FEE_FLAT / 100} platform fee. Please top up your wallet.`,
      });
    }
    if (err instanceof HttpError) {
      return res
        .status(err.status)
        .json({ error: err.message, ...(err.extra ?? {}) });
    }
    logError("shifts:325", err);
    res.status(500).json({ error: "Failed to create shift" });
  } finally {
    session.endSession();
  }
});

router.get("/", requireAuth, isEmployer, async (req, res) => {
  try {
    const employer = await Employer.findOne({ user: req.user._id });
    if (!employer) {
      // Dual-mode empty response — matches whichever shape the caller expects
      return req.query.page !== undefined
        ? res.json({ shifts: [], page: 1, limit: 0, total: 0, hasMore: false })
        : res.json([]);
    }

    const hasPaging = req.query.page !== undefined;

    // ── BACKWARD-COMPATIBLE MODE ──
    // No `page` in query → return a plain array exactly as before.
    // Old clients (fetchMyShifts, useSocketEvents) see zero change.
    if (!hasPaging) {
      const shifts = await Shift.find({ employer: employer._id }).sort({
        createdAt: -1,
      });
      return res.json(shifts);
    }

    // ── PAGED MODE ──
    // `?page=1&limit=20` → return { shifts, page, limit, total, hasMore }.
    // New MyShifts page will use this; nothing else is affected.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [shifts, total] = await Promise.all([
      Shift.find({ employer: employer._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Shift.countDocuments({ employer: employer._id }),
    ]);

    res.json({
      shifts,
      page,
      limit,
      total,
      hasMore: skip + shifts.length < total,
    });
  } catch (err) {
    logError("fetch employer shifts failed:", err);
    res.status(500).json({ error: "Failed to fetch your shifts" });
  }
});

router.get("/open", browseLimiter, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    const shifts = await Shift.find({
      status: "open",
      startTime: { $gt: new Date() },
    })
      .populate("employer", "businessName rating")
      .sort({ startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json(shifts);
  } catch (err) {
    logError("shifts:397", err);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

router.get("/nearby", browseLimiter, async (req, res) => {
  const parsed = nearbyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { radius: radiusKm, skill, date } = parsed.data;
   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = 20;
  const skip = (page - 1) * limit;
  const lat = Math.round(parsed.data.lat * 100) / 100;
  const lng = Math.round(parsed.data.lng * 100) / 100;
  const minPay = parsed.data.minPay ? Math.floor(parsed.data.minPay) : 0;

  try {
    const cacheKey = `shifts:nearby:${lat}:${lng}:${radiusKm}:${skill || ""}:${minPay}:${date || ""}:p${page}`;
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) return res.json(JSON.parse(cached));

    const now = new Date();
    const query = { status: "open", startTime: { $gt: now } };
    if (skill) query.skillRequired = skill;
    if (minPay) query.hourlyPay = { $gte: minPay };
    if (date) {
      const dayStart = new Date(`${date}T00:00:00+05:30`);
      if (Number.isNaN(dayStart.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      query.startTime = {
        $gt: now,
        $gte: dayStart,
        $lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const shifts = await Shift.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query,
        },
      },
      {$skip: skip},
      { $limit: limit+1 },
      {
        $lookup: {
          from: "employers",
          localField: "employer",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $project: {
          title: 1,
          skillRequired: 1,
          hourlyPay: 1,
          startTime: 1,
          endTime: 1,
          address: 1,
          distanceMeters: 1,
          "employer.businessName": 1,
          "employer.rating": 1,
        },
      },
    ]);

    const pageOfShifts = shifts.slice(0, limit);
    await redisClient
      .setEx(cacheKey, 30, JSON.stringify(pageOfShifts))
      .catch(() => {});
    res.json(pageOfShifts);
  } catch (err) {
    logError("shifts:478", err);
    res.status(500).json({ error: "Failed to fetch nearby shifts" });
  }
});

// Group raw statuses into user-facing filter buckets. Keeps the chip row
// short (9 chips) while covering all 12 application statuses.
const STATUS_GROUPS = {
  pending: ["pending"],
  accepted: ["accepted"],
  in_progress: ["in_progress"],
  completed: ["completed"],
  disputed: ["disputed", "pending_resolution"],
  rejected: ["rejected"],
  withdrawn: ["withdrawn"],
  cancelled: [
    "cancelled_by_worker",
    "cancelled_by_employer",
    "cancelled_by_admin",
    "expired",
  ],
};

router.get("/applied", requireAuth, isWorker, async (req, res) => {
  try {
    const hasPaging = req.query.page !== undefined;
    const filter = { worker: req.user._id };

    // ── Status filter ──
    // ?status=pending → filter to just that group. Unknown group → ignore
    // (defensive; frontend only sends valid groups). "all" or absent → no
    // status constraint.
    if (
      req.query.status &&
      req.query.status !== "all" &&
      typeof req.query.status === "string"
    ) {
      const group = STATUS_GROUPS[req.query.status];
      if (group) filter.status = { $in: group };
    }

    // ── Search ──
    // Filter: application's shift title OR shift's employer businessName
    // matches the query. Two-step lookup (employers → shifts) keeps it to
    // 2 queries regardless of app count.
    if (req.query.q && typeof req.query.q === "string") {
      const term = req.query.q.trim().slice(0, 80);
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = { $regex: escaped, $options: "i" };

        const matchingEmployers = await Employer.find({ businessName: rx })
          .select("_id")
          .lean();
        const employerIds = matchingEmployers.map((e) => e._id);

        const shiftOr = [{ title: rx }];
        if (employerIds.length > 0) shiftOr.push({ employer: { $in: employerIds } });

        const matchingShifts = await Shift.find({ $or: shiftOr })
          .select("_id")
          .lean();
        filter.shift = { $in: matchingShifts.map((s) => s._id) };
      }
    }

    const populateConfig = {
      path: "shift",
      populate: {
        path: "employer",
        select: "businessName rating user",
        populate: { path: "user", select: "name phone" },
      },
    };

    // Fetch applications (array or paged)
    let applications;
    let page, limit, total, hasMore;

    if (hasPaging) {
      page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const skip = (page - 1) * limit;

      [applications, total] = await Promise.all([
        Application.find(filter)
          .populate(populateConfig)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Application.countDocuments(filter),
      ]);
      hasMore = skip + applications.length < total;
    } else {
      applications = await Application.find(filter)
        .populate(populateConfig)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    // ── Hydrate with shift records + hide employer phone for non-visible statuses ──
    const shiftIds = applications.map((a) => a.shift?._id).filter(Boolean);
    const records = await ShiftRecord.find({
      worker: req.user._id,
      shift: { $in: shiftIds },
    }).lean();
    const recordsByShiftId = {};
    records.forEach((r) => {
      recordsByShiftId[r.shift.toString()] = r;
    });

    const applicationsWithRecords = applications.map((app) => {
      let shift = app.shift;

      if (
        shift?.employer?.user &&
        !CONTACT_VISIBLE_STATUSES.includes(app.status)
      ) {
        const { phone, ...safeUser } = shift.employer.user;
        shift = {
          ...shift,
          employer: { ...shift.employer, user: safeUser },
        };
      }

      return {
        ...app,
        shift,
        shiftRecord: shift
          ? recordsByShiftId[shift._id.toString()] || null
          : null,
      };
    });

    // Response shape depends on mode
    if (hasPaging) {
      return res.json({
        applications: applicationsWithRecords,
        page,
        limit,
        total,
        hasMore,
      });
    }
    return res.json(applicationsWithRecords);
  } catch (err) {
    logError("fetch applied applications failed:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// ─────────────────────────────────────────────────────────────
// Employer dashboard stats
// GET /api/shifts/employer/stats
// Single call — replaces the N+1 "expand every shift to count applicants"
// that the dashboard was forcing employers to do.
// ─────────────────────────────────────────────────────────────
router.get("/employer/stats", requireAuth, isEmployer, async (req, res) => {
  try {
    const employer = await Employer.findOne({ user: req.user._id })
      .select("_id")
      .lean();

    if (!employer) {
      return res.json({
        totalShifts: 0,
        activeShifts: 0,
        completedShifts: 0,
        pendingApplications: 0,
        onSite: 0,
        disputesNeedingProof: 0,
        thisMonthSpend: 0,
        upcomingShifts: [],
      });
    }

    const now = new Date();
    const monthStart = startOfMonthIST(now);

    const [totalShifts, activeShifts, completedShifts, myShiftIds] =
      await Promise.all([
        Shift.countDocuments({ employer: employer._id }),
        Shift.countDocuments({
          employer: employer._id,
          status: { $in: ["open", "filled"] },
        }),
        Shift.countDocuments({ employer: employer._id, status: "completed" }),
        Shift.find({ employer: employer._id }).select("_id").lean(),
      ]);

    const ids = myShiftIds.map((s) => s._id);

        const [
      pendingApplications,
      onSite,
      disputesNeedingProof,
      feeAgg,
      earningsAgg,
      upcomingShifts,
    ] = await Promise.all([
      ids.length
        ? Application.countDocuments({
            shift: { $in: ids },
            status: "pending",
          })
        : Promise.resolve(0),
      ids.length
        ? Application.countDocuments({
            shift: { $in: ids },
            status: "in_progress",
          })
        : Promise.resolve(0),
      ids.length
        ? Dispute.countDocuments({
            shift: { $in: ids },
            status: "awaiting_proof",
          })
        : Promise.resolve(0),
      // 1. Platform fees the employer paid this month
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: "platform_fee",
            status: "success",
            createdAt: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // 2. Worker earnings released via THIS employer's shifts this month
      //    (the money that actually left the employer's wallet).
      ShiftRecord.aggregate([
        {
          $match: {
            shift: { $in: ids }, // this employer's shifts only (uses the {shift, worker} index)
            status: "completed",
            paymentStatus: "paid",
            clockOut: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amountEarned" } } },
      ]),
      Shift.find({
        employer: employer._id,
        status: { $in: ["open", "filled"] },
        startTime: { $gt: now },
      })
        .sort({ startTime: 1 })
        .limit(3)
        .select("title startTime status workersNeeded acceptedCount")
        .lean(),
    ]);

       // thisMonthSpend: total money that left the employer's wallet this
    // calendar month and stayed out = platform fees paid + worker earnings
    // released. Escrow refunds are excluded (they came back).
    // Not in utils/money.js PAISE_KEYS, so moneyResponse leaves it alone —
    // dividing by 100 makes it arrive in rupees, matching WalletCard.
    const feeTotalPaise = feeAgg[0]?.total ?? 0;
    const earningsTotalPaise = earningsAgg[0]?.total ?? 0;
    const thisMonthSpend = (feeTotalPaise + earningsTotalPaise) / 100;

    res.json({
      totalShifts,
      activeShifts,
      completedShifts,
      pendingApplications,
      onSite,
      disputesNeedingProof,
      thisMonthSpend,
      upcomingShifts: upcomingShifts.map((s) => ({
        _id: s._id,
        title: s.title,
        startTime: s.startTime,
        status: s.status,
        workersNeeded: s.workersNeeded,
        acceptedCount: s.acceptedCount,
      })),
    });
  } catch (err) {
    logError("getEmployerStats failed:", err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

// =========================================================
// NESTED PARAMETERIZED ROUTES
// =========================================================

router.get("/:id/applications", requireAuth, isEmployer, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate("employer");
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    if (shift.employer?.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You don't own this shift" });
    }

    // ✅ NEW: exclude withdrawn from employer view
    const applications = await Application.find({
      shift: shift._id,
      status: { $ne: "withdrawn" },
    })
      .populate("worker", "name phone avatarUrl strikes")
      .sort({ createdAt: -1 })
      .lean();

    const workerUserIds = applications
      .map((app) => app.worker?._id)
      .filter(Boolean);

    const workerProfiles = await Worker.find({ user: { $in: workerUserIds } })
      .select("user rating ratingCount skills")
      .lean();

    const profileMap = {};
    workerProfiles.forEach((profile) => {
      profileMap[profile.user.toString()] = profile;
    });

    const records = await ShiftRecord.find({ shift: shift._id }).lean();
    const recordsByWorkerId = {};
    records.forEach((record) => {
      recordsByWorkerId[record.worker.toString()] = record;
    });

    const applicationsWithRecords = applications.map((app) => {
      let worker = app.worker;
      if (worker && !CONTACT_VISIBLE_STATUSES.includes(app.status)) {
        const { phone, ...safeWorker } = worker;
        worker = safeWorker;
      }
      return {
        ...app,
        worker,
        workerProfile: app.worker
          ? profileMap[app.worker._id.toString()] || null
          : null,
        shiftRecord: app.worker
          ? recordsByWorkerId[app.worker._id.toString()] || null
          : null,
      };
    });

    res.json(applicationsWithRecords);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

router.put(
  "/:id/applications/:appId",
  requireAuth,
  isEmployer,
  async (req, res) => {
    const parsed = applicationStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const session = await mongoose.startSession();
    let application, shiftStatus, shiftTitle, claimed;

    try {
      await session.withTransaction(async () => {
        const shift = await Shift.findById(req.params.id)
          .populate("employer")
          .session(session);
        if (!shift) throw new HttpError(404, "Shift not found");

        if (shift.employer?.user?.toString() !== req.user._id.toString()) {
          throw new HttpError(403, "You don't own this shift");
        }

        application = await Application.findOne({
          _id: req.params.appId,
          shift: shift._id,
        }).session(session);
        if (!application) throw new HttpError(404, "Application not found");

        if (application.status !== "pending") {
          throw new HttpError(409, "This application has already been decided");
        }

        if (parsed.data.status === "rejected") {
          application.status = "rejected";
          await application.save({ session });
          shiftStatus = shift.status;
          shiftTitle = shift.title;
        } else {
          if (shift.startTime <= new Date()) {
            throw new HttpError(409, "This shift has already started");
          }

          const workerUser = await User.findById(application.worker)
            .select("isActive isBanned verificationStatus")
            .session(session);
          if (
            !workerUser ||
            !workerUser.isActive ||
            workerUser.isBanned ||
            workerUser.verificationStatus !== "verified"
          ) {
            throw new HttpError(409, "This worker is no longer available");
          }

          await Worker.updateOne(
            { user: application.worker },
            { $inc: { bookingSeq: 1 } },
            { session },
          );

          const clash = await Application.findOne({
            worker: application.worker,
            _id: { $ne: application._id },
            status: { $in: ["accepted", "in_progress"] },
            scheduledStartAtLock: { $lt: shift.endTime },
            scheduledEndAtLock: { $gt: shift.startTime },
          }).session(session);
          if (clash) {
            throw new HttpError(
              409,
              "This worker is already booked for an overlapping shift",
            );
          }

          claimed = await Shift.findOneAndUpdate(
            {
              _id: shift._id,
              status: { $in: ["open", "filled"] },
              $expr: { $lt: ["$acceptedCount", "$workersNeeded"] },
            },
            { $inc: { acceptedCount: 1 } },
            { session, returnDocument: "after" },
          );

          if (!claimed) {
            throw new HttpError(409, "This shift is already fully staffed");
          }

          await lockEscrow({
            application,
            shift,
            employerUserId: req.user._id,
            session,
          });

          if (
            claimed.acceptedCount >= claimed.workersNeeded &&
            claimed.status === "open"
          ) {
            claimed.status = "filled";
            await claimed.save({ session });
          }
          shiftStatus = claimed.status;
          shiftTitle = claimed.title;
        }
      });
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        return res.status(400).json({
          error:
            "Insufficient wallet balance to secure escrow for this worker. Please top up your wallet.",
        });
      }
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      logError("shifts:949", err);
      return res.status(500).json({ error: "Failed to update application" });
    } finally {
      session.endSession();
    }

    const eventMapping = {
      accepted: "shift:accepted",
      rejected: "shift:rejected",
      cancelled_by_worker: "shift:no_show_marked",
      cancelled_by_employer: "shift:employer_cancelled",
    };
    const eventName = eventMapping[application.status] || "shift:updated";

    safeEmit(application.worker, eventName, {
      applicationId: application._id,
      shiftId: application.shift,
      shiftTitle,
      noShow: application.noShow,
      ...(application.status === "accepted" && {
        escrowAmount: application.escrowAmount,
      }),
    });

    broadcastToRole("worker", "shifts:changed", {
      shiftId: req.params.id,
      reason: "filled",
    });

    res.json({ application, shiftStatus });
  },
);

router.post(
  "/:id/applications/:appId/mark-no-show",
  requireAuth,
  isEmployer,
  async (req, res) => {
    const parsedReason = reasonSchema.safeParse(req.body);
    if (!parsedReason.success) {
      return res
        .status(400)
        .json({ error: "Reason must be text up to 500 characters" });
    }
    const reason = parsedReason.data.reason;
    const session = await mongoose.startSession();
    let application;

    try {
      await session.withTransaction(async () => {
        const shift = await Shift.findById(req.params.id)
          .populate("employer")
          .session(session);
        if (!shift) throw new HttpError(404, "Shift not found");
        if (shift.employer?.user?.toString() !== req.user._id.toString()) {
          throw new HttpError(403, "You don't own this shift");
        }

        application = await Application.findOne({
          _id: req.params.appId,
          shift: shift._id,
        }).session(session);
        if (!application) throw new HttpError(404, "Application not found");
        if (application.status !== "accepted") {
          throw new HttpError(
            409,
            "This worker has already clocked in or this application was already resolved",
          );
        }
        const noShowAllowedAt =
          application.scheduledStartAtLock.getTime() +
          NO_SHOW_GRACE_MINUTES * 60000;
        if (Date.now() < noShowAllowedAt) {
          throw new HttpError(
            409,
            `You can mark a no-show only ${NO_SHOW_GRACE_MINUTES} minutes after the shift start`,
          );
        }
        if (application.arrivedAt) {
          throw new HttpError(
            409,
            "This worker confirmed arrival at the location. Generate an entry code instead.",
          );
        }

        application = await cancelByWorkerFault({
          application,
          employerUserId: req.user._id,
          workerUserId: application.worker,
          reason: reason || "Marked as no-show",
          noShow: true,
          session,
        });

        await reopenShiftIfNeeded(shift, session);
        await recomputeShiftStatus(shift._id, session);
      });
    } catch (err) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      logError("shifts:1049", err);
      return res.status(500).json({ error: "Failed to mark no-show" });
    } finally {
      session.endSession();
    }

    safeEmit(application.worker, "shift:no_show_marked", {
      applicationId: application._id,
      shiftId: application.shift,
    });

    safeEmit(req.user._id, "shift:worker_cancelled", {
      applicationId: application._id,
      shiftId: application.shift,
      freeCancellation: false,
      noShow: true,
    });

    // 2. Workers ke open feeds ko refresh karo (spot khali ho gayi)
    broadcastToRole("worker", "shifts:changed", {
      shiftId: application.shift,
      reason: "no_show",
    });

    // 3. Guest users ko bhi update bhejo
    getIO().to("public:feed").emit("shifts:changed", {
      shiftId: application.shift,
      reason: "no_show",
    });

    const workerUser = await User.findById(application.worker).select(
      "isBanned",
    );
    if (workerUser?.isBanned) {
      enforceBan(application.worker).catch((err) =>
        logError("enforceBan failed:", err),
      );
    }
    res.json({ application });
  },
);

// ✅ NEW: Human-readable "why can't I cancel?" helper
function cancelBlockedMessage(status) {
  switch (status) {
    case "pending":
      return "This application hasn't been accepted yet — withdraw it instead.";
    case "in_progress":
      return "You've already clocked in. Finish the shift with your exit code instead of cancelling.";
    case "pending_resolution":
    case "disputed":
    case "completed":
      return "This shift has already been worked, so it can't be cancelled.";
    default:
      return `This application is already ${String(status).replaceAll("_", " ")}.`;
  }
}

// ✅ NEW: Cancel-preview endpoint
router.get(
  "/:id/applications/:appId/cancel-preview",
  requireAuth,
  isWorker,
  async (req, res) => {
    try {
      const application = await Application.findOne({
        _id: req.params.appId,
        shift: req.params.id,
        worker: req.user._id,
      }).select("status scheduledStartAtLock arrivedAt");
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const strikes = req.user.strikes ?? 0;
      if (application.status === "pending") {
        return res.json({
          action: "withdraw",
          free: true,
          strikes,
          strikesAfter: strikes,
          banThreshold: BAN_THRESHOLD,
          willBeBanned: false,
        });
      }
      if (application.status !== "accepted") {
        return res
          .status(409)
          .json({ error: cancelBlockedMessage(application.status) });
      }

      const outcome = getWorkerCancelOutcome(application);
      const strikesAfter = outcome.free ? strikes : strikes + 1;
      res.json({
        action: "cancel",
        ...outcome,
        strikes,
        strikesAfter,
        banThreshold: BAN_THRESHOLD,
        willBeBanned: strikesAfter >= BAN_THRESHOLD,
      });
    } catch (err) {
      logError("shifts:1151", err);
      res.status(500).json({ error: "Failed to check cancellation" });
    }
  },
);

// ✅ NEW: Withdraw pending application
router.post(
  "/:id/applications/:appId/withdraw",
  requireAuth,
  isWorker,
  async (req, res) => {
    const parsedReason = reasonSchema.safeParse(req.body);
    if (!parsedReason.success) {
      return res
        .status(400)
        .json({ error: "Reason must be text up to 500 characters" });
    }

    try {
      const application = await Application.findOneAndUpdate(
        {
          _id: req.params.appId,
          shift: req.params.id,
          worker: req.user._id,
          status: "pending",
        },
        {
          status: "withdrawn",
          cancelledAt: new Date(),
          cancellationReason: parsedReason.data.reason || "Worker withdrew",
        },
        { returnDocument: "after" },
      );

      if (!application) {
        const existing = await Application.findOne({
          _id: req.params.appId,
          shift: req.params.id,
          worker: req.user._id,
        }).select("status");
        if (!existing)
          return res.status(404).json({ error: "Application not found" });
        return res.status(409).json({
          error:
            existing.status === "accepted"
              ? "The employer has just accepted you — cancel the shift instead."
              : cancelBlockedMessage(existing.status),
        });
      }

      const shift = await Shift.findById(application.shift)
        .select("title employer")
        .populate("employer", "user");
      if (shift?.employer?.user) {
        safeEmit(shift.employer.user, "application:withdrawn", {
          shiftId: shift._id,
          shiftTitle: shift.title,
          workerName: req.user.name,
          applicationId: application._id,
        });
      }
      res.json({ application });
    } catch (err) {
      logError("shifts:1215", err);
      res.status(500).json({ error: "Failed to withdraw application" });
    }
  },
);

// ✅ REPLACED: worker-cancel with free-cancel logic
router.post(
  "/:id/applications/:appId/worker-cancel",
  requireAuth,
  isWorker,
  async (req, res) => {
    const parsedReason = reasonSchema.safeParse(req.body);
    if (!parsedReason.success) {
      return res
        .status(400)
        .json({ error: "Reason must be text up to 500 characters" });
    }
    const reason = parsedReason.data.reason;
    const session = await mongoose.startSession();
    let application, employerUserId, outcome;

    try {
      await session.withTransaction(async () => {
        const shift = await Shift.findById(req.params.id)
          .populate("employer")
          .session(session);
        if (!shift) throw new HttpError(404, "Shift not found");

        application = await Application.findOne({
          _id: req.params.appId,
          shift: shift._id,
        }).session(session);
        if (!application) throw new HttpError(404, "Application not found");
        if (application.worker.toString() !== req.user._id.toString()) {
          throw new HttpError(403, "This isn't your application");
        }
        if (application.status !== "accepted") {
          throw new HttpError(409, cancelBlockedMessage(application.status));
        }

        employerUserId = shift.employer.user;
        outcome = getWorkerCancelOutcome(application);
        application = await cancelByWorkerFault({
          application,
          employerUserId,
          workerUserId: req.user._id,
          reason:
            reason ||
            (outcome.free
              ? "Worker cancelled with enough notice"
              : "Worker cancelled"),
          noShow: false,
          applyStrikeToWorker: !outcome.free,
          session,
        });

        await reopenShiftIfNeeded(shift, session);
        await recomputeShiftStatus(shift._id, session);
      });
    } catch (err) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      logError("shifts:1278", err);
      return res.status(500).json({ error: "Failed to cancel" });
    } finally {
      session.endSession();
    }

    safeEmit(employerUserId, "shift:worker_cancelled", {
      applicationId: application._id,
      shiftId: application.shift,
      freeCancellation: outcome.free,
    });

    const fresh = await User.findById(req.user._id).select("strikes isBanned");

    if (fresh?.isBanned) {
      enforceBan(req.user._id).catch((err) =>
        logError("enforceBan failed:", err),
      );
    }

    res.json({
      application,
      freeCancellation: outcome.free,
      strikes: fresh?.strikes ?? 0,
      isBanned: !!fresh?.isBanned,
    });
  },
);

// ---------- ARRIVED ----------
router.post(
  "/:id/applications/:appId/arrived",
  requireAuth,
  isWorker,
  async (req, res) => {
    const parsed = arrivedSchema.safeParse(req.body ?? {});
    if (!parsed.success)
      return res.status(400).json({ error: "Valid lat and lng are required" });

    try {
      const application = await Application.findOne({
        _id: req.params.appId,
        shift: req.params.id,
        worker: req.user._id,
        status: "accepted",
      });
      if (!application)
        return res.status(404).json({ error: "No accepted application found" });

      const opensAt =
        application.scheduledStartAtLock.getTime() -
        CLOCK_IN_EARLY_MINUTES * 60000;
      if (
        Date.now() < opensAt ||
        Date.now() > application.scheduledEndAtLock.getTime()
      ) {
        return res
          .status(409)
          .json({ error: "You can only check in around the shift time" });
      }

      const shift = await Shift.findById(req.params.id).populate("employer");
      const [shiftLng, shiftLat] = shift.location.coordinates;

      const dist = distanceMeters(
        parsed.data.lat,
        parsed.data.lng,
        shiftLat,
        shiftLng,
      );

      if (dist > ARRIVAL_RADIUS_METERS) {
        return res
          .status(400)
          .json({ error: "You don't appear to be at the shift location yet" });
      }

      application.arrivedAt = new Date();
      application.arrivalDistanceMeters = Math.round(dist);
      await application.save();

      safeEmit(shift.employer.user, "shift:worker_arrived", {
        shiftId: shift._id,
        applicationId: application._id,
      });

      res.json({ arrivedAt: application.arrivedAt });
    } catch (err) {
      logError("shifts:1366", err);
      res.status(500).json({ error: "Failed to record arrival" });
    }
  },
);

// ---------- EMPLOYER CANCEL WORKER ----------
router.post(
  "/:id/applications/:appId/employer-cancel",
  requireAuth,
  isEmployer,
  async (req, res) => {
    const parsedReason = reasonSchema.safeParse(req.body);
    if (!parsedReason.success) {
      return res
        .status(400)
        .json({ error: "Reason must be text up to 500 characters" });
    }
    const reason = parsedReason.data.reason;
    const session = await mongoose.startSession();
    let result, workerId;

    try {
      await session.withTransaction(async () => {
        const shift = await Shift.findById(req.params.id)
          .populate("employer")
          .session(session);
        if (!shift) throw new HttpError(404, "Shift not found");
        if (shift.employer?.user?.toString() !== req.user._id.toString()) {
          throw new HttpError(403, "You don't own this shift");
        }

        const application = await Application.findOne({
          _id: req.params.appId,
          shift: shift._id,
        }).session(session);
        if (!application) throw new HttpError(404, "Application not found");
        if (application.status !== "accepted") {
          throw new HttpError(
            409,
            "This worker has already clocked in or this application was already resolved",
          );
        }

        workerId = application.worker;
        result = await cancelByEmployer({
          application,
          employerUserId: req.user._id,
          workerUserId: workerId,
          reason: reason || "Employer cancelled",
          session,
        });

        await reopenShiftIfNeeded(shift, session);
        await recomputeShiftStatus(shift._id, session);
      });
    } catch (err) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      logError("shifts:1425", err);
      return res.status(500).json({ error: "Failed to cancel worker" });
    } finally {
      session.endSession();
    }

    safeEmit(workerId, "shift:cancelled_by_employer", {
      applicationId: result.application._id,
      shiftId: result.application.shift,
      penaltyPaidToYou: result.penaltyToWorker,
    });
    res.json({
      application: result.application,
      wasLateCancellation: result.isLate,
    });
  },
);

// ---------- FORCE CLOCK-OUT ----------
router.post(
  "/:id/applications/:appId/force-clock-out",
  requireAuth,
  isEmployer,
  async (req, res) => {
    const parsed = forceClockOutSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid exit time" });

    const exitTime = parsed.data.exitTime
      ? new Date(parsed.data.exitTime)
      : new Date();
    if (Number.isNaN(exitTime.getTime()) || exitTime > new Date()) {
      return res
        .status(400)
        .json({ error: "Exit time must be a valid time in the past" });
    }

    const session = await mongoose.startSession();
    let record, workerId, employerUserId;

    try {
      await session.withTransaction(async () => {
        const shift = await Shift.findById(req.params.id)
          .populate("employer")
          .session(session);
        if (!shift) throw new HttpError(404, "Shift not found");
        if (shift.employer?.user?.toString() !== req.user._id.toString()) {
          throw new HttpError(403, "You don't own this shift");
        }
        employerUserId = shift.employer?.user;
        const application = await Application.findById(
          req.params.appId,
        ).session(session);
        if (
          !application ||
          application.shift.toString() !== shift._id.toString()
        ) {
          throw new HttpError(404, "Application not found");
        }
        workerId = application.worker;

        const shiftRecord = await ShiftRecord.findOne({
          shift: shift._id,
          worker: application.worker,
          status: "ongoing",
        }).session(session);
        if (!shiftRecord)
          throw new HttpError(
            404,
            "This worker doesn't have an active clock-in to force-close",
          );
        if (exitTime < shiftRecord.clockIn)
          throw new HttpError(
            400,
            "Exit time can't be before the clock-in time",
          );

        const { hoursWorked, workerAmount, employerRefund } =
          computeSettlementSplit({
            clockIn: shiftRecord.clockIn,
            exitTime,
            scheduledStart: application.scheduledStartAtLock, // ✅ ADD
            scheduledEnd: application.scheduledEndAtLock,
            hourlyPayAtLock: application.hourlyPayAtLock,
            escrowAmount: application.escrowAmount,
          });

        const disputeWindowExpiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        );
        record = await ShiftRecord.findByIdAndUpdate(
          shiftRecord._id,
          {
            clockOut: exitTime,
            hoursWorked,
            amountEarned: workerAmount,
            employerRefund,
            paymentStatus: "pending",
            status: "pending_resolution",
            exitMethod: "forced",
            forcedBy: req.user._id,
            forcedAt: new Date(),
            disputeWindowExpiresAt,
          },
          { returnDocument: "after", session },
        );

        application.status = "pending_resolution";
        await application.save({ session });
      });
    } catch (err) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      logError("shifts:1538", err);
      return res.status(500).json({ error: "Failed to force clock-out" });
    } finally {
      session.endSession();
    }

    safeEmit(workerId, "shift:force_clocked_out", {
      shiftId: req.params.id,
      proposedAmountEarned: record.amountEarned,
      disputeWindowExpiresAt: record.disputeWindowExpiresAt,
      note: "If this doesn't look right, you can dispute it within 24 hours.",
    });

    // ✅ FIX: Notify the employer too — so other employer tabs update live.
    if (employerUserId) {
      safeEmit(employerUserId, "shift:force_clocked_out", {
        shiftId: req.params.id,
        proposedAmountEarned: record.amountEarned,
        disputeWindowExpiresAt: record.disputeWindowExpiresAt,
        note: "You force-closed this worker's shift.",
      });
    }
    res.json({ record });
  },
);

// ---------- APPLY (with revive logic) ----------
router.post(
  "/:id/apply",
  requireAuth,
  isWorker,
  requireVerified,
  async (req, res) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid application data" });
    }

    try {
      const shift = await Shift.findById(req.params.id).populate("employer");
      if (!shift || shift.status !== "open") {
        return res.status(404).json({ error: "Shift not available" });
      }
      if (shift.startTime < new Date())
        return res.status(400).json({ error: "This shift already started" });

      // ✅ Explicit check of existing application (regardless of status).
      // Relying on the unique index alone is not enough because cancelled/
      // rejected rows are not blocked by a plain unique index.
      const existing = await Application.findOne({
        shift: shift._id,
        worker: req.user._id,
      });

      let application;

      if (existing) {
        // --- ACTIVE → block ---
        if (["pending", "accepted", "in_progress"].includes(existing.status)) {
          return res.status(409).json({
            error:
              existing.status === "pending"
                ? "You already have a pending application for this shift"
                : "You are already accepted for this shift",
          });
        }

        // --- Worker cancelled an accepted shift → HARD BLOCK ---
        if (existing.status === "cancelled_by_worker") {
          return res.status(409).json({
            error:
              "You cancelled this shift earlier, so you can't apply to it again.",
          });
        }

        // --- Rejected → block (retry only via employer's invite, not self-apply) ---
        if (existing.status === "rejected") {
          return res.status(409).json({
            error: "Your application for this shift was rejected.",
          });
        }

        // --- Cancelled by employer/admin/expired → block with specific messages ---
        if (existing.status === "cancelled_by_employer") {
          return res.status(409).json({
            error: "The employer cancelled this shift for you.",
          });
        }
        if (existing.status === "cancelled_by_admin") {
          return res.status(409).json({
            error: "An administrator cancelled this shift.",
          });
        }
        if (existing.status === "expired") {
          return res.status(409).json({
            error: "This shift application has expired.",
          });
        }

        // --- Withdrawn → revive allowed (worker self-withdrew from pending) ---
        if (existing.status === "withdrawn") {
          existing.status = "pending";
          existing.message = parsed.data.message || "";
          existing.noShow = false;
          existing.strikeApplied = false;
          existing.cancelledAt = null;
          existing.cancellationReason = undefined;
          existing.penaltyToWorker = 0;
          existing.refundToEmployer = 0;
          existing.escrowAmount = 0;
          existing.escrowStatus = "not_locked";
          existing.escrowLockedAt = null;
          existing.escrowReleasedAt = null;
          existing.maxPayout = 0;
          existing.hourlyPayAtLock = null;
          existing.scheduledStartAtLock = null;
          existing.scheduledEndAtLock = null;
          existing.arrivedAt = null;
          existing.arrivalDistanceMeters = null;
          application = await existing.save();
        } else {
          // Unknown status — defensive block
          return res.status(409).json({
            error: `This application is already ${existing.status.replaceAll("_", " ")}.`,
          });
        }
      } else {
        // --- First time → create ---
        application = await Application.create({
          shift: shift._id,
          worker: req.user._id,
          message: parsed.data.message || "",
        });
      }

      if (shift.employer?.user) {
        safeEmit(shift.employer.user, "application:new", {
          shiftId: shift._id,
          shiftTitle: shift.title,
          workerName: req.user.name,
          applicationId: application._id,
        });
      }

      res.status(201).json({ application });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          error: "You already applied to this shift",
        });
      }
      logError("shifts:1689", err);
      res.status(500).json({ error: "Failed to apply" });
    }
  },
);

// ---------- OTP: GENERATE ENTRY / EXIT ----------
router.get("/:id/active-otp", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store"); // response contains a live OTP
  const { purpose = "entry", workerId: rawWorkerId } = req.query;

  if (purpose !== "entry" && purpose !== "exit") {
    return res.status(400).json({ error: "purpose must be 'entry' or 'exit'" });
  }

  let workerId;
  if (purpose === "entry") {
    if (req.user.role !== "employer") {
      return res
        .status(403)
        .json({ error: "Only employers can query entry codes" });
    }
    if (typeof rawWorkerId !== "string" || !OBJECT_ID.test(rawWorkerId)) {
      return res
        .status(400)
        .json({ error: "workerId query param is required" });
    }
    workerId = rawWorkerId;
  } else {
    if (req.user.role !== "worker") {
      return res
        .status(403)
        .json({ error: "Only workers can query exit codes" });
    }
    workerId = req.user._id.toString();
  }

  try {
    const shift = await Shift.findById(req.params.id).populate("employer");
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    if (purpose === "entry") {
      if (shift.employer?.user?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "You don't own this shift" });
      }
      const accepted = await Application.findOne({
        shift: shift._id,
        worker: workerId,
        status: "accepted",
      });
      if (!accepted) return res.json({ otp: null, expiresAt: null });
    } else {
      const record = await ShiftRecord.findOne({
        shift: shift._id,
        worker: workerId,
        status: "ongoing",
      });
      if (!record) return res.json({ otp: null, expiresAt: null });
    }

    const key = `otp:${purpose}:${shift._id}:${workerId}`;
    const code = await redisClient.get(key).catch(() => null);
    if (!code) return res.json({ otp: null, expiresAt: null });

    const ttl = await redisClient.ttl(key).catch(() => -1);
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;

    res.json({ otp: code, expiresAt });
  } catch (err) {
    logError("shifts:1758", err);
    res.status(500).json({ error: "Failed to load active code" });
  }
});

router.post(
  "/:id/generate-otp",
  requireAuth,
  isEmployer,
  otpRequestLimiter,
  async (req, res) => {
    const { workerId } = req.query;
    if (typeof workerId !== "string" || !OBJECT_ID.test(workerId)) {
      return res
        .status(400)
        .json({ error: "workerId query param is required" });
    }

    try {
      const shift = await Shift.findById(req.params.id).populate("employer");
      if (!shift) return res.status(404).json({ error: "Shift not found" });

      if (shift.employer?.user?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "You don't own this shift" });
      }

      const acceptedApplication = await Application.findOne({
        shift: shift._id,
        worker: workerId,
        status: "accepted",
      });
      if (!acceptedApplication) {
        return res
          .status(400)
          .json({ error: "This worker was not accepted for this shift" });
      }

      const opensAt =
        acceptedApplication.scheduledStartAtLock.getTime() -
        CLOCK_IN_EARLY_MINUTES * 60000;
      if (
        Date.now() < opensAt ||
        Date.now() > acceptedApplication.scheduledEndAtLock.getTime()
      ) {
        return res.status(409).json({
          error: "Entry codes can only be generated around the shift time",
        });
      }
      const code = await createOtp(shift._id.toString(), workerId, "entry");

      res.set("Cache-Control", "no-store");
      res.json({ otp: code, expiresInMinutes: 15 });
    } catch (err) {
      logError("shifts:1811", err);
      res.status(500).json({ error: "Failed to generate OTP" });
    }
  },
);

router.post(
  "/:id/generate-exit-otp",
  requireAuth,
  isWorker,
  otpRequestLimiter,
  async (req, res) => {
    try {
      const record = await ShiftRecord.findOne({
        shift: req.params.id,
        worker: req.user._id,
        status: "ongoing",
      });
      if (!record) {
        return res
          .status(400)
          .json({ error: "You don't have an active clock-in for this shift" });
      }
      const code = await createOtp(
        req.params.id,
        req.user._id.toString(),
        "exit",
      );

      await ShiftRecord.updateOne(
        { _id: record._id, exitOtpRequestedAt: null },
        { exitOtpRequestedAt: new Date() },
      );
      res.set("Cache-Control", "no-store");
      res.json({ otp: code, expiresInMinutes: 15 });
    } catch (err) {
      logError("shifts:1847", err);
      res.status(500).json({ error: "Failed to generate exit OTP" });
    }
  },
);

// ---------- CLOCK IN / OUT ----------
router.post(
  "/:id/clock-in",
  requireAuth,
  isWorker,
  otpRequestLimiter,
  async (req, res) => {
    const parsed = clockInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "A 6-digit OTP is required" });
    }

    const pending = await Application.findOne({
      shift: req.params.id,
      worker: req.user._id,
      status: "accepted",
    });
    if (!pending) {
      return res
        .status(409)
        .json({ error: "This shift is no longer available to clock into" });
    }
    const opensAt =
      pending.scheduledStartAtLock.getTime() - CLOCK_IN_EARLY_MINUTES * 60000;
    if (
      Date.now() < opensAt ||
      Date.now() > pending.scheduledEndAtLock.getTime()
    ) {
      return res
        .status(409)
        .json({ error: "You can only clock in around the shift time" });
    }

    const isValid = await verifyAndConsumeOtp(
      req.params.id,
      req.user._id.toString(),
      parsed.data.otp,
      "entry",
    );
    if (!isValid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const session = await mongoose.startSession();
    let record;

    try {
      await session.withTransaction(async () => {
        const application = await Application.findOne({
          shift: req.params.id,
          worker: req.user._id,
          status: "accepted",
        }).session(session);

        if (!application) {
          throw new HttpError(
            409,
            "This shift is no longer available to clock into",
          );
        }

        const [created] = await ShiftRecord.create(
          [
            {
              shift: req.params.id,
              worker: req.user._id,
              application: application._id,
              clockIn: new Date(),
              status: "ongoing",
              scheduledEnd: application.scheduledEndAtLock,
            },
          ],
          { session },
        );
        record = created;

        application.status = "in_progress";
        await application.save({ session });
      });
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({
          error: err.message,
          note: "Your entry code was already used — ask your employer to generate a new one if you still need to clock in.",
        });
      }
      logError("shifts:1939", err);
      return res.status(500).json({ error: "Failed to clock in" });
    } finally {
      session.endSession();
    }

    const shift = await Shift.findById(req.params.id).populate({
      path: "employer",
      select: "user",
    });

    const payload = { shiftId: req.params.id, clockIn: record.clockIn };
    safeEmit(req.user._id, "shift:clocked_in", payload);
    if (shift?.employer?.user) {
      safeEmit(shift.employer.user, "shift:clocked_in", payload);
    }
    res.json({ record });
  },
);

router.post(
  "/:id/clock-out",
  requireAuth,
  isEmployer,
  otpRequestLimiter,
  async (req, res) => {
    const parsed = clockOutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "workerId and a 6-digit OTP are required" });
    }
    const { workerId, otp } = parsed.data;

    const shift = await Shift.findById(req.params.id).populate("employer");
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    if (shift.employer?.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You don't own this shift" });
    }

    const isValid = await verifyAndConsumeOtp(
      req.params.id,
      workerId,
      otp,
      "exit",
    );
    if (!isValid) {
      return res.status(400).json({ error: "Invalid or expired exit OTP" });
    }

    const session = await mongoose.startSession();
    let record;

    try {
      await session.withTransaction(async () => {
        const shiftRecord = await ShiftRecord.findOne({
          shift: req.params.id,
          worker: workerId,
          status: "ongoing",
        })
          .populate("application")
          .session(session);
        if (!shiftRecord)
          throw new HttpError(
            404,
            "No active clock-in found for this worker on this shift",
          );

        const application = shiftRecord.application;
        const { hoursWorked, workerAmount, employerRefund } =
          computeSettlementSplit({
            clockIn: shiftRecord.clockIn,
            exitTime: new Date(),
            scheduledStart: application.scheduledStartAtLock,
            scheduledEnd: application.scheduledEndAtLock,
            hourlyPayAtLock: application.hourlyPayAtLock,
            escrowAmount: application.escrowAmount,
          });

        record = await finalizeSettlement({
          shiftRecordId: shiftRecord._id,
          applicationId: application._id,
          workerUserId: workerId,
          employerUserId: req.user._id,
          employerId: shift.employer._id,
          workerAmount,
          employerRefund,
          shiftId: shift._id,
          session,
          exitMethod: "otp",
          extra: { hoursWorked, clockOut: new Date() },
        });
      });
    } catch (err) {
      if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
      logError("shifts:2035", err);
      return res.status(500).json({ error: "Failed to clock out" });
    } finally {
      session.endSession();
    }

    safeEmit(workerId, "shift:clocked_out", {
      shiftId: req.params.id,
      amountEarned: record.amountEarned,
    });

    // ✅ FIX: Notify the EMPLOYER too (all their tabs/devices). This is what
    // closes the "open second employer tab doesn't see completion" gap.
    if (shift?.employer?.user) {
      safeEmit(shift.employer.user, "shift:clocked_out", {
        shiftId: req.params.id,
        amountEarned: record.amountEarned,
      });
    }
    res.json({ record });
  },
);

// ---------- REVIEWS ----------
router.get("/:id/reviews", browseLimiter, async (req, res) => {
  try {
    const reviews = await Review.find({ shift: req.params.id })
      .populate("reviewer", "name")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/:id/review", requireAuth, async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const shift = await Shift.findById(req.params.id).populate("employer");
    if (!shift) return res.status(404).json({ error: "Shift not found" });

    let revieweeId, reviewerRole;

    if (req.user.role === "worker") {
      const record = await ShiftRecord.findOne({
        shift: shift._id,
        worker: req.user._id,
        status: "completed",
      });
      if (!record) {
        return res
          .status(403)
          .json({ error: "You can only review shifts you completed" });
      }
      revieweeId = shift.employer?.user;
      if (!revieweeId) {
        return res
          .status(400)
          .json({ error: "This shift has no reviewable employer account" });
      }
      reviewerRole = "worker";
    } else if (req.user.role === "employer") {
      if (shift.employer?.user?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: "You don't own this shift" });
      }
      const targetWorkerId = parsed.data.revieweeId;
      if (!targetWorkerId) {
        return res
          .status(400)
          .json({ error: "revieweeId (the worker's user id) is required" });
      }
      const record = await ShiftRecord.findOne({
        shift: shift._id,
        worker: targetWorkerId,
        status: "completed",
      });
      if (!record) {
        return res
          .status(400)
          .json({ error: "That worker did not complete this shift" });
      }
      revieweeId = targetWorkerId;
      reviewerRole = "employer";
    } else {
      return res
        .status(403)
        .json({ error: "Only workers and employers may leave reviews" });
    }

    const review = await Review.create({
      shift: shift._id,
      reviewer: req.user._id,
      reviewee: revieweeId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      reviewerRole,
    });

    await recomputeAverageRating(
      revieweeId,
      reviewerRole === "worker" ? "employer" : "worker",
    );

    // ✅ NEW: Notify the reviewee
    safeEmit(revieweeId, "review:new", {
      reviewerName: req.user.name,
      shiftTitle: shift.title,
      rating: parsed.data.rating,
    });

    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "You already reviewed this" });
    }
    logError("shifts:2155", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// ---------- PUT / DELETE ----------
router.put("/:id", requireAuth, isEmployer, async (req, res) => {
  const parsed = shiftUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const shift = await Shift.findById(req.params.id).populate("employer");
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    if (shift.employer?.user?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You don't own this shift" });
    }

    if (!["open", "filled"].includes(shift.status)) {
      return res
        .status(409)
        .json({ error: `A ${shift.status} shift can't be edited` });
    }

    const liveApplications = await Application.countDocuments({
      shift: shift._id,
      status: {
        $in: [
          "pending",
          "accepted",
          "in_progress",
          "pending_resolution",
          "disputed",
          "completed",
        ],
      },
    });
    if (liveApplications > 0) {
      const frozenFields = [
        "hourlyPay",
        "startTime",
        "endTime",
        "workersNeeded",
        "address",
        "lat",
        "lng",
        "skillRequired",
      ];
      if (frozenFields.some((f) => parsed.data[f] !== undefined)) {
        return res.status(409).json({
          error:
            "Pay, time, location and worker count are locked once workers have applied. Reject or cancel the existing applications first, or cancel this shift and post a new one.",
        });
      }
    }

    const nextStart = parsed.data.startTime
      ? new Date(parsed.data.startTime)
      : shift.startTime;
    const nextEnd = parsed.data.endTime
      ? new Date(parsed.data.endTime)
      : shift.endTime;

    if (!(nextEnd > nextStart)) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }

    if (nextEnd - nextStart > MAX_SHIFT_HOURS * 3600000) {
      return res.status(400).json({
        error: `A shift can't be longer than ${MAX_SHIFT_HOURS} hours`,
      });
    }

    if (parsed.data.startTime && nextStart <= new Date()) {
      return res.status(400).json({ error: "startTime must be in the future" });
    }

    const updates = { ...parsed.data };
    if (updates.lat != null && updates.lng != null) {
      updates.location = {
        type: "Point",
        coordinates: [updates.lng, updates.lat],
      };
    }
    delete updates.lat;
    delete updates.lng;
    if (updates.startTime) updates.startTime = new Date(updates.startTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);

    Object.assign(shift, updates);
    await shift.save();

    await invalidateNearbyCache();
    const payload = { shiftId: shift._id, reason: "edited" };

    broadcastToRole("worker", "shifts:changed", payload); // Workers ke liye
    safeEmit(req.user._id, "shifts:changed", payload); // Employer ke baaki tabs ke liye
    getIO().to("public:feed").emit("shifts:changed", payload); // Guests ke liye
    res.json({ shift });
  } catch (err) {
    logError("shifts:2256", err);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

router.delete("/:id", requireAuth, isEmployer, async (req, res) => {
  const session = await mongoose.startSession();
  const notifications = [];
  const pendingWorkerIds = []; // ✅ NEW

  try {
    await session.withTransaction(async () => {
      const shift = await Shift.findById(req.params.id)
        .populate("employer")
        .session(session);
      if (!shift) throw new HttpError(404, "Shift not found");
      if (shift.employer?.user?.toString() !== req.user._id.toString()) {
        throw new HttpError(403, "You don't own this shift");
      }

      const activeRecords = await ShiftRecord.find({
        shift: shift._id,
      }).session(session);
      if (activeRecords.length > 0) {
        throw new HttpError(
          403,
          "Cannot cancel shift. One or more workers have already clocked in.",
        );
      }

      const acceptedApplications = await Application.find({
        shift: shift._id,
        status: "accepted",
      }).session(session);

      for (const application of acceptedApplications) {
        const result = await cancelByEmployer({
          application,
          employerUserId: req.user._id,
          workerUserId: application.worker,
          reason: "Shift cancelled by employer",
          session,
        });
        notifications.push({
          workerId: application.worker,
          penalty: result.penaltyToWorker,
        });
      }

      const pendingApps = await Application.find({
        shift: shift._id,
        status: "pending",
      })
        .select("worker")
        .session(session);
      pendingWorkerIds.push(...pendingApps.map((a) => a.worker));

      await Application.updateMany(
        { shift: shift._id, status: "pending" },
        { $set: { status: "rejected" } },
        { session },
      );

      shift.status = "cancelled";
      await shift.save({ session });
    });
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    logError("shifts:2325", err);
    return res.status(500).json({ error: "Failed to cancel shift" });
  } finally {
    session.endSession();
  }

  await invalidateNearbyCache();

  const payload = { shiftId: req.params.id, reason: "cancelled" };

  broadcastToRole("worker", "shifts:changed", payload);
  safeEmit(req.user._id, "shifts:changed", payload); // Employer ke baaki tabs
  getIO().to("public:feed").emit("shifts:changed", payload); // Guests

  notifications.forEach(({ workerId, penalty }) => {
    safeEmit(workerId, "shift:cancelled_by_employer", {
      shiftId: req.params.id,
      penaltyPaidToYou: penalty,
    });
  });

  // ✅ NEW: Notify pending workers that the shift was cancelled
  pendingWorkerIds.forEach((id) => {
    safeEmit(id, "shift:updated", { shiftId: req.params.id });
  });

  res.json({ cancelled: true, applicationsRefunded: notifications.length });
});


// ---------- WILDCARD GET ----------
router.get("/:id", browseLimiter, optionalAuth, async (req, res) => {
  try {
    // "user" is populated so ShiftDetail can work out isOwnShift, but it is
    // only sent to the shift's own employer (and admins), not to the public.
    const shift = await Shift.findById(req.params.id).populate(
      "employer",
      "businessName rating user",
    );
    if (!shift) {
      return res.status(404).json({ error: "Shift not found" });
    }
    const out = shift.toJSON();
    const ownerId = out.employer?.user ? String(out.employer.user) : null;
    const isOwner = req.user && ownerId && ownerId === String(req.user._id);
    if (out.employer && !isOwner && req.user?.role !== "admin") {
      delete out.employer.user;
    }
    res.json(out);
  } catch (err) {
    res.status(404).json({ error: "Shift not found" });
  }
});

export default router;