// server/src/models/Application.js
import mongoose from "mongoose";

const isPaise = (v) => v == null || Number.isInteger(v);
const paiseValidator = { validator: isPaise, message: "{PATH} must be an integer number of paise" };
const applicationSchema = new mongoose.Schema(
  {
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "rejected",
        "withdrawn",
        "accepted",
        "cancelled_by_employer",
        "cancelled_by_worker",
        "cancelled_by_admin",
        "expired",
        "in_progress",
        "pending_resolution",
        "disputed",
        "completed",
      ],
      default: "pending",
    },
    message: { type: String, maxlength: 500 },

    maxPayout: { type: Number, validate: paiseValidator, default: 0 },
    escrowAmount: { type: Number, validate: paiseValidator, default: 0 },
    escrowStatus: {
      type: String,
      enum: ["not_locked", "locked", "released"],
      default: "not_locked",
    },
    escrowLockedAt: { type: Date, default: null },
    escrowReleasedAt: { type: Date, default: null },

    hourlyPayAtLock: { type: Number, default: null },
    scheduledStartAtLock: { type: Date, default: null },
    scheduledEndAtLock: { type: Date, default: null },

    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, maxlength: 500 },
    noShow: { type: Boolean, default: false },
    // ✅ NEW: Did this cancellation cost the worker a strike?
    strikeApplied: { type: Boolean, default: false },
    arrivedAt: { type: Date, default: null },
    arrivalDistanceMeters: { type: Number, default: null },
    refundToEmployer: { type: Number, validate: paiseValidator, default: 0 },
    penaltyToWorker: { type: Number, validate: paiseValidator, default: 0 },

    dispute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispute",
      default: null,
    },
  },
  { timestamps: true },
);

applicationSchema.index({ worker: 1, createdAt: -1 });
applicationSchema.index({ worker: 1, status: 1 });
applicationSchema.index({ shift: 1, worker: 1 }, { unique: true });
applicationSchema.index({ shift: 1, status: 1 });
applicationSchema.index({ status: 1, scheduledEndAtLock: 1 });
applicationSchema.index({ escrowStatus: 1 }, { partialFilterExpression: { escrowStatus: "locked" } });

export default mongoose.model("Application", applicationSchema);