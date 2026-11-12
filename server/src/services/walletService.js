// server/src/services/walletService.js
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import PlatformWallet from "../models/PlatformWallet.js";

export class InsufficientFundsError extends Error {
  constructor(userId) {
    super("Insufficient wallet balance");
    this.name = "InsufficientFundsError";
    this.userId = userId;
  }
}

export async function adjustWallet({
  userId,
  delta,
  type,
  amount,
  shift = null,
  application = null,
  status = "success",
  session,
  transactionId = null, // <-- NEW: update an existing row instead of creating
}) {
  if (!Number.isInteger(delta) || !Number.isInteger(amount)) {
    throw new Error("Wallet amounts must be integer paise");
  }
  if (!session) {
    throw new Error("adjustWallet requires an active Mongo session");
  }

  const filter = { _id: userId };
  if (delta < 0) {
    filter.walletBalance = { $gte: -delta };
  }

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: delta } },
    { returnDocument: "after", session },
  );

  if (!user) {
    throw new InsufficientFundsError(userId);
  }

  if (transactionId) {
    // The mutation was already recorded as a Transaction when the intent
    // was created (e.g. topup created in createTopupOrder, withdrawal
    // created in requestPayout). We only need to close it out with the
    // final status and the balance snapshot. Deliberately NOT overwriting
    // type/direction/amount/shift/application — those were correct at
    // creation time.
    const updated = await Transaction.findByIdAndUpdate(
      transactionId,
      { status, balanceAfter: user.walletBalance },
      { returnDocument: "after", session },
    );
    if (!updated) {
      throw new Error(`adjustWallet: transactionId ${transactionId} not found`);
    }
  } else {
    // The mutation IS its own event (escrow lock, cancellation penalty,
    // payout reversal, etc.) — create a fresh ledger row.
    await Transaction.create(
      [
        {
          user: userId,
          type,
          direction: delta >= 0 ? "credit" : "debit",
          amount,
          status,
          shift,
          application,
          balanceAfter: user.walletBalance,
        },
      ],
      { session },
    );
  }

  return user;
}

export async function creditPlatform({
  delta,
  type,
  amount,
  shift = null,
  session,
}) {
  if (!Number.isInteger(delta) || !Number.isInteger(amount)) {
    throw new Error("Wallet amounts must be integer paise");
  }
  if (!session)
    throw new Error("creditPlatform requires an active Mongo session");

  const wallet = await PlatformWallet.findByIdAndUpdate(
    "platform",
    { $inc: { balance: delta },  $setOnInsert: { createdAt: new Date() }, },
    { returnDocument: "after", upsert: true, session},
  );

  await Transaction.create(
    [
      {
        user: null,
        type,
        direction: delta >= 0 ? "credit" : "debit",
        amount,
        status: "success",
        shift,
        application: null,
        balanceAfter: wallet.balance,
      },
    ],
    { session },
  );
  return wallet;
}
