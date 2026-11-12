// server/src/routes/transactions.js
// Read-only transaction history for the current user (worker or employer).
// Amounts are paise in DB; moneyResponse middleware converts to rupees.
import express from "express";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import { requireAuth } from "../middleware/auth.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

// GET /api/transactions?page=1&limit=20&direction=all|credit|debit&from=...&to=...
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    if (req.query.direction === "credit" || req.query.direction === "debit") {
      filter.direction = req.query.direction;
    }

    if (req.query.from || req.query.to) {
      const toDate = (v) => {
        if (typeof v !== "string") return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const from = req.query.from ? toDate(req.query.from) : undefined;
      const to = req.query.to ? toDate(req.query.to) : undefined;
      if (from === null || to === null) {
        return res
          .status(400)
          .json({ error: "from and to must be valid dates" });
      }
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }
    const [transactions, total, totalsAgg] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("shift", "title")
        .lean(),
      Transaction.countDocuments(filter),
      // Full-history aggregate — independent of pagination/filters.
      // Returned in RUPEES (not paise) because "total" is not in
      // moneyResponse's PAISE_KEYS, so the middleware leaves it alone.
      // List amounts stay in paise and get converted by middleware —
      // frontend ends up with everything in rupees, consistently.
      Transaction.aggregate([
        { $match: { user: req.user._id } },
        {
          $group: {
            _id: "$direction",
            totalPaise: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totals = {
      credit: { total: 0, count: 0 },
      debit: { total: 0, count: 0 },
    };
    for (const row of totalsAgg) {
      totals[row._id] = {
        total: row.totalPaise / 100,
        count: row.count,
      };
    }

    res.json({
      transactions,
      page,
      limit,
      total,
      hasMore: skip + transactions.length < total,
      totals, // ← NEW: full-history credit/debit totals (rupees)
    });
  } catch (err) {
    logError("fetch transactions failed", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

// GET /api/transactions/:id — full detail for one transaction
// Only the owner can fetch their own transaction.
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id, // 👈 Security: only own transactions
    })
      .populate({
        path: "shift",
        select: "title address startTime endTime hourlyPay",
        populate: {
          path: "employer",
          select: "businessName user",
          populate: { path: "user", select: "name" },
        },
      })
      .populate({
        path: "application",
        select: "worker",
        populate: { path: "worker", select: "name" },
      })
      .lean();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    res.json(tx);
  } catch (err) {
    logError("fetch transaction detail failed", err);
    res.status(500).json({ error: "Failed to load transaction" });
  }
});

export default router;
