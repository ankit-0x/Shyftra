// server/src/controllers/earningsController.js
import ShiftRecord from "../models/ShiftRecord.js";
import Worker from "../models/Worker.js"; // Don't forget to import this!
import Transaction from "../models/Transaction.js";
import {z} from "zod";

import { logError } from "../utils/logger.js";
export async function getEarningsSummary(req, res) {
  try {
    // 1. Fetch the worker profile to get their lifetime stats
    const workerProfile = await Worker.findOne({ user: req.user._id });
    
    if (!workerProfile) {
      return res.status(404).json({ error: "Worker profile not found" });
    }

   

    // 2. Combine the wallet balance (from User) with the stats (from Worker)
    res.json({
      walletBalance: req.user.walletBalance,
      totalEarnings: workerProfile.totalEarnings || 0,
      totalShifts: workerProfile.shiftsCompleted || 0, 
    });
  } catch (err) {
    logError("earningsController:25", err);
    res.status(500).json({ error: "Failed to fetch earnings summary" });
  }
}

export async function getEarningsStats(req, res) {
  const parsedPeriod = z.enum(["daily", "weekly", "monthly"]).safeParse(req.query.period ?? "daily");
if (!parsedPeriod.success) {
  return res.status(400).json({ error: "period must be daily, weekly, or monthly" });
}
const unit = { daily: "day", weekly: "week", monthly: "month" }[parsedPeriod.data];

  try {
    const stats = await ShiftRecord.aggregate([
      { $match: { worker: req.user._id, status: "completed" } },
      {
        // Groups every completed record into calendar buckets (e.g. "this
        // whole day" or "this whole week") — done by MongoDB, not by us.
        $group: {
          _id: { $dateTrunc: { date: "$clockOut", unit, timezone: "Asia/Kolkata", } },
          totalEarned: { $sum: "$amountEarned" },
          shiftsCompleted: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } }, // most recent period first
      { $limit: 30 },
    ]);

    res.json(
      stats.map((s) => ({
        period: s._id,
        totalEarned: s.totalEarned,
        shiftsCompleted: s.shiftsCompleted,
      }))
    );
  } catch (err) {
    logError("earningsController:61", err);
    res.status(500).json({ error: "Failed to fetch earnings stats" });
  }
}

export async function getShiftHistory(req, res) {
  try {
    const records = await ShiftRecord.find({ worker: req.user._id, status: "completed" })
      .populate({
        path: "shift",
        populate: { path: "employer", select: "businessName" },
      })
      .sort({ clockOut: -1 })
      .limit(50);

    res.json(records);
  } catch (err) {
    logError("earningsController:78", err);
    res.status(500).json({ error: "Failed to fetch shift history" });
  }
}

// ✅ NEW: Compensation / bonus history (cancellation penalties, dispute
// payouts). Duplicate-proof: any compensation whose shift ALSO has a
// completed ShiftRecord for this worker is excluded — that shift already
// shows in Shift History, so we don't want to double-display it.
export async function getCompensationHistory(req, res) {
  try {
    const COMP_TYPES = ["cancellation_penalty", "dispute_payout"];

    // 1. Candidate compensation transactions for this worker.
    const rows = await Transaction.find({
      user: req.user._id,
      type: { $in: COMP_TYPES },
      direction: "credit",
      status: "success",
    })
      .populate({ path: "shift", select: "title" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (rows.length === 0) return res.json([]);

    // 2. Which of those shifts ALSO have a completed ShiftRecord for this
    //    worker? Those are already visible in Shift History.
    const shiftIds = rows.map((t) => t.shift?._id).filter(Boolean);

    const completedRecords = shiftIds.length
      ? await ShiftRecord.find({
          worker: req.user._id,
          shift: { $in: shiftIds },
          status: "completed",
        })
          .select("shift")
          .lean()
      : [];

    const completedShiftIds = new Set(
      completedRecords.map((r) => r.shift.toString()),
    );

    // 3. Exclude any compensation whose shift is already in Shift History.
    const filtered = rows.filter((t) => {
      if (!t.shift?._id) return true; // no linked shift → keep
      return !completedShiftIds.has(t.shift._id.toString());
    });

    res.json(
      filtered.map((t) => ({
        _id: t._id,
        type: t.type,
        amount: t.amount, // paise
        createdAt: t.createdAt,
        shift: t.shift ? { _id: t.shift._id, title: t.shift.title } : null,
      })),
    );
  } catch (err) {
    logError("earningsController:139", err);
    res.status(500).json({ error: "Failed to fetch compensations" });
  }
}