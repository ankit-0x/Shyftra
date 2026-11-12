// server/src/models/Dispute.js
import mongoose from "mongoose";

const disputeSchema = new mongoose.Schema(
  {
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    shiftRecord: { type: mongoose.Schema.Types.ObjectId, ref: "ShiftRecord", required: true },

    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    reason: { type: String, required: true, maxlength: 1000 },
    workerClaimedClockOut: { type: Date, required: true }, // 👈 NAYA FIELD

    status: {
      type: String,
      enum: ["awaiting_proof", "under_review", "resolved"],
      default: "awaiting_proof",
    },
    proofDeadline: { type: Date, required: true },

    evidenceUrls: { type: [String], default: [] },
    evidencePublicIds: { type: [String], default: [] },
    evidenceResourceTypes: { type: [String], default: [] },
    evidenceSubmittedAt: { type: Date, default: null },

    ruledFor: { type: String, enum: ["worker", "employer"], default: null },
    ruledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    autoResolved: { type: Boolean, default: false },
    resolution: { type: String, maxlength: 1000 },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

disputeSchema.index({ status: 1, proofDeadline: 1 });
disputeSchema.index({ shiftRecord: 1 }, { unique: true });
disputeSchema.index({ worker: 1, createdAt: -1 });
disputeSchema.index({ employer: 1, createdAt: -1 });
disputeSchema.index({ createdAt: -1 });

export default mongoose.model("Dispute", disputeSchema);