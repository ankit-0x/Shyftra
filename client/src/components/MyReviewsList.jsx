// client/src/components/MyReviewsList.jsx
import { useSelector } from "react-redux";
import { Link } from "react-router";
import { Star, Loader2, MessageSquare, Briefcase } from "lucide-react";

function MyReviewsList({ limit }) {
  const allReviews = useSelector((state) => state.reviews.myReviews);
  const status = useSelector((state) => state.reviews.fetchStatus);

  const reviews = limit ? allReviews?.slice(0, limit) : allReviews;

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="bg-error/10 border border-error/20 p-4 rounded-2xl text-center">
        <p className="text-sm font-bold text-error">Failed to load reviews.</p>
      </div>
    );
  }

  if (!reviews?.length) {
    return (
      <div className="bg-base-100 border border-base-200 rounded-2xl p-8 text-center flex flex-col items-center">
        <MessageSquare className="w-8 h-8 text-base-content/20 mb-2" />
        <p className="text-sm font-medium text-base-content/60">
          You haven't reviewed anyone yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div 
          key={r._id} 
          className="bg-base-100 border border-base-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 overflow-hidden border border-primary/10">
              {r.reviewee?.avatarUrl ? (
                <img
                  src={r.reviewee.avatarUrl}
                  alt={r.reviewee.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-extrabold text-primary text-sm">
                  {r.reviewee?.name?.[0]?.toUpperCase() || "?"}
                </span>
              )}
            </div>
            
            {/* Header Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-base-content truncate">
                You reviewed {r.reviewee?.name || "Unknown"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${
                        n <= r.rating
                          ? "text-warning fill-warning"
                          : "text-base-300 fill-base-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-base-content/50">
                  • {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Comment Bubble */}
          {r.comment && (
            <div className="mt-3.5">
              <p className="text-sm text-base-content/80 bg-base-200/50 p-3.5 rounded-xl border border-base-200 italic leading-relaxed">
                "{r.comment}"
              </p>
            </div>
          )}

          {/* Shift Link Context */}
          {r.shift?.title && (
            <div className="mt-3.5 flex items-center">
              <Link
                to={`/shifts/${r.shift._id}`}
                className="text-xs font-semibold text-primary bg-primary/5 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Shift: {r.shift.title}
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MyReviewsList;