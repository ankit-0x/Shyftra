// client/src/components/ReviewList.jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import ReviewCard from "./ReviewCard";
import { fetchUserReviews } from "../store/reviewsSlice";

function ReviewList({ userId, limit }) {
  const dispatch = useDispatch();
  const data = useSelector(
    (state) => state.reviews.reviewsByUserId[userId],
  );
  const status = useSelector(
    (state) => state.reviews.userReviewsStatus[userId],
  );

  // data = { reviews: [...], total: N } — pick the array, then optionally slice
  const allReviews = data?.reviews;
  const reviews = limit ? allReviews?.slice(0, limit) : allReviews;

  useEffect(() => {
    if (userId) dispatch(fetchUserReviews({ userId, page: 1, limit: 20 }));
  }, [userId, dispatch]);

  if (status === "loading" || status === "idle") {
    return <span className="loading loading-spinner loading-sm" />;
  }

  if (status === "failed") {
    return <p className="text-sm text-error">Failed to load reviews.</p>;
  }

  if (!reviews?.length) {
    return <p className="text-sm opacity-70">No reviews yet.</p>;
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard key={r._id} review={r} showShiftTitle />
      ))}
    </div>
  );
}

export default ReviewList;
