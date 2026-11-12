// server/src/models/Strike.js
import mongoose from "mongoose";

const strikeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, maxlength: 500 },
    source: { type: String, enum: ["no_show", "worker_cancellation" ,"dispute_loss"], required: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    dispute: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute" },
    // Snapshot of the user's total strike count right after this one landed —
    // answers "was this the 3rd strike that triggered the ban" without
    // replaying history.
    strikeNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

strikeSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Strike", strikeSchema);