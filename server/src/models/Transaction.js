// server/src/models/Transaction.js
import mongoose from "mongoose";
const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: [
        "topup",
        "withdrawal",
        "platform_fee",
        "escrow_lock",
        "escrow_release",        // worker's earnings, paid out of escrow
        "escrow_refund",         // unused escrow returned to the employer
        "cancellation_penalty",  // late-cancel penalty paid to the worker
        "dispute_payout",  
        "payout_reversal",
        "admin_forfeit",
        "admin_manual_refund",      // payout resulting from a resolved dispute
      ],
      required: true,
    },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, validate: paiseValidator, required: true }, // always positive — `type` tells you the direction
    status: { type: String, enum: ["pending", "processing", "success", "failed", "reversed"], default: "pending" },
    failureReason: { type: String },

    // Existing Razorpay-gateway fields (topup/withdrawal only)
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpayPayoutId: { type: String },

    // NEW: so "every transaction for this shift" is a direct query for
    // support/admin, not a guess from timestamps and amounts.
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", default: null },

    // NEW: wallet balance immediately AFTER this transaction. Nothing
    // computes off this — it's purely a debugging/audit snapshot.
    balanceAfter: { type: Number, validate: paiseValidator, default: null },
    reconciledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ shift: 1 });

// Unique + partial: real idempotency for webhooks, and no collection scans.
transactionSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } },
);
transactionSchema.index(
  { razorpayPayoutId: 1 },
  { unique: true, partialFilterExpression: { razorpayPayoutId: { $type: "string" } } },
);
transactionSchema.index({ type: 1, status: 1, createdAt: 1 }); // payout reconciliation

export default mongoose.model("Transaction", transactionSchema);