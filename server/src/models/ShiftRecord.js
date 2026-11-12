// server/src/models/ShiftRecord.js
import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };
const shiftRecordSchema = new mongoose.Schema(
  {
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // NEW: direct link back to the contract that funded this record — lets
    // settlement code read escrowAmount / hourlyPayAtLock in one populate
    // instead of a reverse query every time.
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },

    clockIn: { type: Date },
    clockOut: { type: Date },
    hoursWorked: { type: Number },
    amountEarned: { type: Number, validate: paiseValidator },        // paid to the WORKER
    employerRefund: { type: Number, validate: paiseValidator, default: 0 }, // the flip side, back to the employer

    status: {
      type: String,
      enum: ["scheduled", "ongoing", "pending_resolution", "disputed", "completed"],
      default: "scheduled",
    },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    exitOtpRequestedAt: { type: Date, default: null },
    // --- NEW: which of the 3 clock-out paths closed this shift ---
    exitMethod: { type: String, enum: ["otp", "forced", "auto_cron", "disputed"], default: null },
    forcedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    forcedAt: { type: Date, default: null },
    autoClosedAt: { type: Date, default: null },

    // NEW: copied from Application.scheduledEndAtLock at clock-in time.
    // This is what makes the Path C cron job cheap: it queries this index
    // directly instead of populating shift on every ongoing record.
    scheduledEnd: { type: Date, default: null },

    // --- NEW: dispute window (Phase 5) — only set on the "forced" path ---
    disputeWindowExpiresAt: { type: Date, default: null },
    dispute: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute", default: null },
  },
  { timestamps: true }
);

shiftRecordSchema.index({ worker: 1, status: 1 });
shiftRecordSchema.index({ shift: 1, worker: 1 }, { unique: true });
// Powers the two cron sweeps: Path C auto-close, and the 24h
// pending_resolution window that quietly finalizes an undisputed force-close.
shiftRecordSchema.index({ status: 1, scheduledEnd: 1 });
shiftRecordSchema.index({ status: 1, disputeWindowExpiresAt: 1 });

export default mongoose.model("ShiftRecord", shiftRecordSchema);