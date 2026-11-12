// client/src/pages/AllReviews.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { fetchUserReviews } from "../store/reviewsSlice";
import ReviewList from "../components/ReviewList";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";

function AllReviews() {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const [page, setPage] = useState(1);
  
  const status = useSelector((state) => state.reviews.userReviewsStatus[userId]);
  const data = useSelector((state) => state.reviews.reviewsByUserId[userId]);

  useEffect(() => {
    dispatch(fetchUserReviews({ userId, page, limit: 20 }));
  }, [userId, page, dispatch]);

  // Derived loading states for better UI feedback
  const isLoadingFirstPage = status === "loading" && !data?.reviews?.length;
  const isLoadingMore = status === "loading" && data?.reviews?.length > 0;

  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        
        {/* Navigation & Header */}
        <div>
          <Link 
            to="/profile" 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/60 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to profile
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-base-content">
                All Reviews
              </h1>
              {data?.total !== undefined && (
                <p className="text-base-content/60 text-sm mt-1">
                  {data.total} {data.total === 1 ? "review" : "reviews"} received
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoadingFirstPage ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-base-content/60 text-sm font-medium">Loading reviews...</p>
          </div>
        ) : (
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-6">
            <ReviewList userId={userId} />
            
            {/* Pagination / Load More */}
            {data?.reviews?.length < data?.total && (
              <div className="flex justify-center mt-8 pt-6 border-t border-base-200/60">
                <button
                  className="btn btn-outline border-base-300 hover:bg-base-200 hover:text-base-content hover:border-base-300 gap-2 min-w-35"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}

export default AllReviews;