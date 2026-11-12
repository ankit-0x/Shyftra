// server/src/services/withdrawalService.js
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { TOPUP_HOLD_HOURS, EARNINGS_HOLD_HOURS } from "../config/businessRules.js";

const HOUR = 60 * 60 * 1000;

// Balance minus money that arrived recently and is still on hold.
// All values are integer paise.
// Pass a session to read inside a transaction. The two reads are
// sequential on purpose: Mongo doesn't support parallel operations on one session.
export async function computeWithdrawable(userId, session = null) {
  const now = Date.now();

  const walletQuery = User.findById(userId).select("walletBalance").lean();
  const heldQuery = Transaction.aggregate([
    {
      $match: {
        user: userId,
        status: "success",
        $or: [
          { type: "topup", updatedAt: { $gte: new Date(now - TOPUP_HOLD_HOURS * HOUR) } },
          {
            type: { $in: ["escrow_release", "cancellation_penalty"] },
            createdAt: { $gte: new Date(now - EARNINGS_HOLD_HOURS * HOUR) },
          },
        ],
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  if (session) {
    walletQuery.session(session);
    heldQuery.session(session);
  }

  const wallet = await walletQuery;
  const [held] = await heldQuery;

  const balance = wallet?.walletBalance ?? 0;
  const heldTotal = held?.total ?? 0;

   // Tripwire during the paise migration — remove once stable.
  if (!Number.isInteger(balance) || !Number.isInteger(heldTotal)) {
    throw new Error(
      `computeWithdrawable: non-integer money for user ${userId} ` +
        `(balance=${balance}, held=${heldTotal})`,
    );
  }
   const effectiveHeld = Math.min(heldTotal, balance);

  return {
    balance,
    held: effectiveHeld,
    withdrawable: Math.max(0, balance - effectiveHeld),
  };
}