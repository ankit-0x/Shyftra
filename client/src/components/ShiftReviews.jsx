// client/src/components/ShiftReviews.jsx
// Reviews left on one shift — GET /api/shifts/:id/reviews (public, newest
// first, up to 50). Shows an average + distribution summary, then each review.
import { Star, MessageSquare, AlertCircle } from "lucide-react";
import { useApiQuery } from "../hooks/useApiQuery";
import StarRating from "./StarRating";
import ReviewCard from "./ReviewCard";
import { useLiveTick } from "../hooks/useLiveTick";

function Summary({ reviews }) {
  const total = reviews.length;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-8 sm:gap-12 rounded-3xl border border-base-200 bg-base-100 p-6 sm:p-8 shadow-sm">
      {/* Average Score Block */}
      <div className="text-center shrink-0 flex flex-col items-center">
        <p className="text-5xl font-black text-base-content tracking-tighter">
          {average.toFixed(1)}
        </p>
        <div className="mt-2 mb-1">
          <StarRating value={average} size={18} />
        </div>
        <p className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider mt-1">
          {total} review{total === 1 ? "" : "s"}
        </p>
      </div>

      {/* Distribution Bars */}
      <ul className="flex-1 w-full max-w-sm space-y-2.5" aria-label="Rating breakdown">
        {counts.map(({ stars, count }) => (
          <li key={stars} className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5 w-8 justify-end text-base-content/70">
              <span>{stars}</span>
              <Star size={12} className="text-warning fill-warning shrink-0" aria-hidden="true" />
            </div>
            <progress 
              className="progress progress-warning flex-1 h-2 bg-base-200" 
              value={count} 
              max={total} 
              aria-label={`${count} ${stars}-star reviews`} 
            />
            <span className="w-8 text-right text-base-content/50">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShiftReviews({ shiftId }) {

    const reviewTick = useLiveTick("review:new", shiftId);
  // ✅ Pass refreshToken so the query refetches silently when a new review arrives
  const { data: reviews, loading, error } = useApiQuery(
    `/api/shifts/${shiftId}/reviews`, 
    {}, 
    !!shiftId,
    { refreshToken: reviewTick }
  );
  
  return (
    <section aria-labelledby="shift-reviews-heading" className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <Star className="w-5 h-5 text-primary fill-primary/20" />
        <h2 id="shift-reviews-heading" className="text-xl font-extrabold text-base-content tracking-tight">
          Shift Reviews
        </h2>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-40 bg-base-200/50 rounded-3xl animate-pulse"></div>
          <div className="h-32 bg-base-200/50 rounded-2xl animate-pulse"></div>
          <div className="h-32 bg-base-200/50 rounded-2xl animate-pulse"></div>
        </div>
      ) : error ? (
        <div className="bg-error/10 border border-error/20 p-6 rounded-2xl text-center flex flex-col items-center">
          <AlertCircle className="w-8 h-8 text-error mb-2" />
          <p role="alert" className="text-sm font-bold text-error">
            Couldn't load reviews: {error}
          </p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-base-100 rounded-3xl border border-base-200 p-8 sm:p-12 text-center flex flex-col items-center shadow-sm">
          <div className="w-14 h-14 bg-base-200/50 rounded-2xl flex items-center justify-center mb-3 border border-base-200">
            <MessageSquare className="w-6 h-6 text-base-content/30" />
          </div>
          <p className="text-sm font-medium text-base-content/60 max-w-xs leading-relaxed">
            No reviews yet. Workers and employers can rate each other once the shift is completed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <Summary reviews={reviews} />
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review._id} review={review} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default ShiftReviews;