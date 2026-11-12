// server/src/services/ledgerService.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Application from "../models/Application.js";
import PlatformWallet from "../models/PlatformWallet.js";
import LedgerCheck from "../models/LedgerCheck.js";

import { logError } from "../utils/logger.js";
// Wallet amounts are floats in rupees until the paise migration (Step 27),
// so a tiny drift is tolerated. Set both to 0 after that migration.
const USER_TOLERANCE = 0;
const GLOBAL_TOLERANCE = 0;
const round2 = (n) => +Number(n ?? 0);

const IN_FLIGHT = ["accepted", "in_progress", "pending_resolution", "disputed"];

// Every query is awaited one at a time: no parallel operations on one session.
export async function computeLedgerReport(session) {
  const issues = [];

  // --- Where the money is ---
  const [walletAgg] = await User.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: "$walletBalance" },
        negative: { $sum: { $cond: [{ $lt: ["$walletBalance", 0] }, 1, 0] } },
      },
    },
  ]).session(session);

  const [escrowAgg] = await Application.aggregate([
    { $match: { escrowStatus: "locked" } },
    { $group: { _id: null, total: { $sum: "$escrowAmount" } } },
  ]).session(session);

  const platform = await PlatformWallet.findById("platform").session(session).lean();

  // --- Where it came from and went ---
  const [inAgg] = await Transaction.aggregate([
    { $match: { type: "topup", status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);

  // Failed and reversed withdrawals were refunded by a separate payout_reversal
  // row, so they no longer count as money that left.
  const [outAgg] = await Transaction.aggregate([
    { $match: { type: "withdrawal", status: { $in: ["pending", "processing", "success"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);

  const walletTotal = round2(walletAgg?.total);
  const lockedEscrow = round2(escrowAgg?.total);
  const platformBalance = round2(platform?.balance);
  const topupsIn = round2(inAgg?.total);
  const withdrawalsOut = round2(outAgg?.total);

  const heldTotal = round2(walletTotal + lockedEscrow + platformBalance);
  const expectedTotal = round2(topupsIn - withdrawalsOut);
  const difference = round2(heldTotal - expectedTotal);

  if (Math.abs(difference) > GLOBAL_TOLERANCE) {
    issues.push(
      `Books don't balance: wallets + escrow + platform = ${heldTotal/100}, but top-ups minus withdrawals = ${expectedTotal/100} (difference ${difference/100})`,
    );
  }

  // --- Each wallet against its own transaction history ---
  // A topup only credited the wallet if it succeeded. Everything else,
  // including withdrawals in any status, moved the wallet when it was created.
  const mismatches = await Transaction.aggregate([
    { $match: { user: { $ne: null }, $nor: [{ type: "topup", status: { $ne: "success" } }] } },
    {
      $group: {
        _id: "$user",
        ledger: {
          $sum: {
            $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }],
          },
        },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    {
      $project: {
        ledger: 1,
        wallet: "$u.walletBalance",
        diff: { $subtract: ["$u.walletBalance", "$ledger"] },
      },
    },
    { $match: { $expr: { $gt: [{ $abs: "$diff" }, USER_TOLERANCE] } } },
    { $limit: 50 },
  ]).session(session);

  if (mismatches.length > 0) {
    issues.push(`${mismatches.length} wallet(s) don't match their transaction history`);
  }

  // Wallets holding money with no transaction at all (needs MongoDB 5.0+).
  const orphanWallets = await User.aggregate([
    { $match: { walletBalance: { $ne: 0 } } },
    {
      $lookup: {
        from: "transactions",
        localField: "_id",
        foreignField: "user",
        pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }],
        as: "tx",
      },
    },
    { $match: { tx: { $size: 0 } } },
    { $project: { walletBalance: 1 } },
    { $limit: 50 },
  ]).session(session);

  if (orphanWallets.length > 0) {
    issues.push(`${orphanWallets.length} wallet(s) hold money with no transactions`);
  }

  if ((walletAgg?.negative ?? 0) > 0) {
    issues.push(`${walletAgg.negative} wallet(s) have a negative balance`);
  }

  // Escrow still "locked" on an application that is finished or cancelled:
  // the money is neither with the employer nor the worker.
  const strandedEscrow = await Application.countDocuments({
    escrowStatus: "locked",
    status: { $nin: IN_FLIGHT },
  }).session(session);
  if (strandedEscrow > 0) {
    issues.push(`${strandedEscrow} application(s) have locked escrow but are not active`);
  }

  return {
    ok: issues.length === 0,
    issues,
    totals: { walletTotal, lockedEscrow, platformBalance, topupsIn, withdrawalsOut, heldTotal, expectedTotal, difference },
    details: { mismatches, orphanWallets, negativeWallets: walletAgg?.negative ?? 0, strandedEscrow },
  };
}

async function sendAlert(message) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` for Slack-style hooks, `content` for Discord-style; check which your service accepts.
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logError("ledger alert failed:", err);
  }
}

export async function runLedgerCheck() {
  const session = await mongoose.startSession();
  let report;
  try {
    // A snapshot read means every query sees the same moment in time, so money
    // moving mid-check can't cause a false alarm.
    await session.withTransaction(
      async () => {
        report = await computeLedgerReport(session);
      },
      { readConcern: { level: "snapshot" } },
    );
  } finally {
    session.endSession();
  }

  await LedgerCheck.create(report);

  if (report.ok) {
    console.log("✅ Ledger check passed", report.totals);
  } else {
    console.error("🚨 LEDGER MISMATCH", JSON.stringify(report));
    await sendAlert(`🚨 Shyftra ledger check FAILED:\n- ${report.issues.join("\n- ")}`);
  }
  return report;
}