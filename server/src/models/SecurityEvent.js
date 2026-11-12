// server/src/models/SecurityEvent.js
// Append-only audit trail for account-security and payout events.
import mongoose from "mongoose";

const securityEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      required: true,
      enum: [
        "email_verified",
        "password_reset",
        "password_changed",
        "payout_method_set",
        "payout_otp_sent",
        "payout_otp_failed",
        "payout_reauth_failed",
        "payout_requested",
        "payout_blocked_cooldown",
        "email_change_requested",
        "email_change_failed",
        "email_changed",
        "force_logout",
        "admin_reauth_failed",
        "wallet_forfeited",
        "wallet_refunded_offline",
      ],
    },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed }, // NEVER put secrets / full account numbers here
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
securityEventSchema.index({ user: 1, createdAt: -1 });
securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("SecurityEvent", securityEventSchema);
