// server/src/cron/reconcilePayouts.js
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import { adjustWallet } from "../services/walletService.js";
import { razorpayXRequest, mapPayoutStatus } from "../config/razorpayx.js";

import { logError } from "../utils/logger.js";
const STUCK_AFTER_MS = 30 * 60 * 1000;      // don't touch fresh withdrawals
const NO_RECORD_GRACE_MS = 2 * 60 * 60 * 1000; // wait this long before believing "RazorpayX has nothing"
const BATCH = 50;

async function settleWithdrawal(tx, newStatus, payout) {
  const isDead = newStatus === "failed" || newStatus === "reversed";
  const update = { status: newStatus };
  if (payout?.id) update.razorpayPayoutId = payout.id;
  if (isDead) update.failureReason = `Reconciliation: RazorpayX reported ${payout?.status ?? "no payout found"}`;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Claim atomically: if a webhook already handled this, we get null and do nothing.
      const updated = await Transaction.findOneAndUpdate(
        { _id: tx._id, status: { $in: ["pending", "processing"] } },
        update,
        { returnDocument: "after", session },
      );
      if (!updated || !isDead) return;

      await adjustWallet({
        userId: updated.user,
        delta: updated.amount,
        type: "payout_reversal",
        amount: updated.amount,
        session,
      });
    });
  } finally {
    session.endSession();
  }
}

export async function runReconcilePayouts() {
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!accountNumber) {
    console.error("reconcilePayouts: RAZORPAYX_ACCOUNT_NUMBER is not set, skipping");
    return 0;
  }

  const now = Date.now();
  const stuck = await Transaction.find({
    type: "withdrawal",
    status: { $in: ["pending", "processing"] },
    createdAt: { $lt: new Date(now - STUCK_AFTER_MS) },
    $or: [{ reconciledAt: null }, { reconciledAt: { $lt: new Date(now - STUCK_AFTER_MS) } }],
  })
    .sort({ createdAt: 1 })
    .limit(BATCH);

  let resolved = 0;
  for (const tx of stuck) {
    try {
      let payout = null;
      if (tx.razorpayPayoutId) {
        payout = await razorpayXRequest(`/payouts/${tx.razorpayPayoutId}`, "GET");
      } else {
        const lookup = await razorpayXRequest(
          `/payouts?account_number=${encodeURIComponent(accountNumber)}&reference_id=${tx._id}`,
          "GET",
        );
        payout = lookup?.items?.[0] || null;
      }

      if (payout) {
        const newStatus = mapPayoutStatus(payout.status);
        if (newStatus !== tx.status) {
          await settleWithdrawal(tx, newStatus, payout);
          resolved++;
        }
      } else if (now - tx.createdAt.getTime() > NO_RECORD_GRACE_MS) {
        // RazorpayX has no record after 2h, so the create call never landed. Refund.
        await settleWithdrawal(tx, "failed", null);
        resolved++;
      }

      await Transaction.updateOne({ _id: tx._id }, { $set: { reconciledAt: new Date() } });
    } catch (err) {
      logError(`reconcilePayouts: transaction ${tx._id} failed:`, err);
    }
  }

  if (resolved > 0) console.log(`✅ Reconciled ${resolved} withdrawal(s)`);
  return resolved;
}