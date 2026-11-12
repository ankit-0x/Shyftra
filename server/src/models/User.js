// server/src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = {
  validator: isPaise,
  message: "{PATH} must be an integer number of paise",
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select:false => the hash is NEVER loaded unless a query asks for "+password".
    password: { type: String, required: true, select: false },
    phone: { type: String, required: true },
    role: {
      type: String,
      enum: ["worker", "employer", "admin"],
      required: true,
    },
    avatarUrl: { type: String, default: "" },
    avatarPublicId: { type: String },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    freeShiftsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    verificationDocPublicId: { type: String, default: null, select: false },
    isActive: { type: Boolean, default: true },
    walletBalance: { type: Number, validate: paiseValidator, default: 0 },

    // ---- Email verification (Task 2) ----
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },

    // ---- Password reset / change (Tasks 3-4) ----
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    passwordChangedAt: { type: Date, default: null },

    // ---- Payout verification (Task 5) ----
    payoutOtpHash: { type: String, default: null, select: false },
    payoutOtpExpires: { type: Date, default: null, select: false },
    payoutOtpPurpose: { type: String, default: null, select: false },
    payoutOtpAttempts: { type: Number, default: 0, select: false },
    payoutOtpSentAt: { type: Date, default: null, select: false },
    lastPayoutVerifiedAt: { type: Date, default: null, select: false },
    // Non-secret display info for the UI (masked) + 24h cooling period.
    payoutMethodLabel: { type: String, default: null },
    payoutMethodChangedAt: { type: Date, default: null },
    payoutCooldownUntil: { type: Date, default: null },

    razorpayContactId: { type: String, default: null , select: false},
    razorpayFundAccountId: { type: String, default: null , select: false},
    payoutMode: {
      type: String,
      enum: ["UPI", "IMPS"],
      default: null,
    },
    // 🆕 Session revocation version.
    // Increment this on password change/reset to invalidate all existing JWTs.
    // Every access + refresh token carries a `tv` claim; middleware compares it
    // to this value. Mismatch → 401.
    tokenVersion: { type: Number, default: 0, min: 0 },
    // ---- Email change with OTP ----
    // The NEW address parks in pendingEmail until proven by a 6-digit code.
    // Only the SHA-256 hash of the code is stored.
    pendingEmail: { type: String, default: null, lowercase: true, trim: true, select: false },
    emailChangeOtpHash: { type: String, default: null, select: false },
    emailChangeOtpExpires: { type: Date, default: null, select: false },
    emailChangeOtpAttempts: { type: Number, default: 0, select: false },
    emailChangeOtpSentAt: { type: Date, default: null, select: false },

    strikes: { type: Number, default: 0, min: 0 },
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, default: null },
    banEnforcedAt: { type: Date, default: null },
    tokenRevokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ verificationStatus: 1, createdAt: 1 }); // admin "pending" list
userSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
userSchema.index({ isBanned: 1, banEnforcedAt: 1 }); // ban cleanup cron
userSchema.index({ role: 1, createdAt: -1 });

export default mongoose.model("User", userSchema);
