// server/src/utils/ratings.js
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Worker from "../models/Worker.js";
import Employer from "../models/Employer.js";

// targetType tells us which collection actually needs updating —
// revieweeId is always a User's _id, but a User who's an employer doesn't
// store their own rating; their linked Employer document does.
export async function recomputeAverageRating(revieweeId, targetType) {
  
  const objectId = new mongoose.Types.ObjectId(revieweeId);
    const stats = await Review.aggregate([
    { $match: { reviewee: objectId } },
    { $group: { _id: "$reviewee", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avgRating = stats[0]?.avgRating || null;
  const count = stats[0]?.count || 0;

  const finalRating = avgRating ? +avgRating.toFixed(2) : null;

  if (targetType === "worker") {
    await Worker.findOneAndUpdate({user: revieweeId}, {
      rating: finalRating,
      ratingCount: count,
    });
  } else {
    await Employer.findOneAndUpdate(
      { user: revieweeId },
      { rating: finalRating, 
        ratingCount: count,
    });
  }
}