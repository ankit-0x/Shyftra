import mongoose from "mongoose";

const adminActionSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "verify_user", "block_user"
    targetType: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);
adminActionSchema.index({ admin: 1, createdAt: -1 });
adminActionSchema.index({ targetId: 1, createdAt: -1 });
adminActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1095 * 24 * 60 * 60 });

export default mongoose.model("AdminAction", adminActionSchema);