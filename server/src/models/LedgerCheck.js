import mongoose from "mongoose";

const ledgerCheckSchema = new mongoose.Schema(
  {
    ok: { type: Boolean, required: true },
    issues: { type: [String], default: [] },
    totals: { type: mongoose.Schema.Types.Mixed },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Keep six months of history.
ledgerCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("LedgerCheck", ledgerCheckSchema);