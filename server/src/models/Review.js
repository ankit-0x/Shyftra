// server/src/models/Review.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    reviewerRole: { type: String, enum: ["worker", "employer"], required: true },
  },
  { timestamps: true }
);

reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
// Plan-specified index: one review per (shift, reviewer). See the "honest
// limitation" note above for what this means on multi-worker shifts.
reviewSchema.index({ shift: 1, reviewer: 1, reviewee: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);