// client/src/components/ReviewCard.jsx
// One review: who wrote it, stars, when, and what they said.
// Shared by the shift page (ShiftReviews) and profile review lists.
import { Briefcase, MessageSquare } from "lucide-react";
import StarRating from "./StarRating";
import { formatDateTime, formatRelativeTime } from "../utils/format";

const ROLE_LABEL = { worker: "Worker", employer: "Employer" };

function ReviewCard({ review, showShiftTitle = false }) {
  const { reviewer, rating, comment, createdAt, reviewerRole, shift } = review;
  const name = reviewer?.name || "Former user";

  return (
    <article className="rounded-2xl border border-base-200 bg-base-100 p-4 sm:p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 overflow-hidden border border-primary/10">
          {reviewer?.avatarUrl ? (
            <img 
              src={reviewer.avatarUrl} 
              alt={name} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <span className="font-extrabold text-primary text-sm">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Header Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="font-bold text-sm text-base-content truncate">{name}</p>
              {ROLE_LABEL[reviewerRole] && (
                <span className="badge font-medium uppercase px-2 py-0.5 text-[10px] bg-base-200/60 text-base-content/70 border-base-200">
                  {ROLE_LABEL[reviewerRole]}
                </span>
              )}
            </div>
            
            <time 
              dateTime={new Date(createdAt).toISOString()} 
              title={formatDateTime(createdAt)} 
              className="text-[11px] font-medium text-base-content/40 shrink-0"
            >
              {formatRelativeTime(createdAt)}
            </time>
          </div>
          
          <div className="mt-1">
            <StarRating value={rating} size={14} />
          </div>
        </div>
      </div>

      {/* Comment Body */}
      <div className="mt-3.5">
        {comment ? (
          <p className="text-sm text-base-content/80 bg-base-200/40 p-3.5 rounded-xl border border-base-200/60 leading-relaxed whitespace-pre-line wrap-break-word italic">
            "{comment}"
          </p>
        ) : (
          <p className="text-xs font-medium text-base-content/40 flex items-center gap-1.5 italic px-1">
            <MessageSquare className="w-3.5 h-3.5" /> No written feedback provided.
          </p>
        )}
      </div>

      {/* Shift Context Footer */}
      {showShiftTitle && shift?.title && (
        <div className="mt-3.5 pt-3 border-t border-base-200/60 flex items-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-base-200/40 text-[11px] font-semibold text-base-content/60 max-w-full">
            <Briefcase className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Shift: {shift.title}</span>
          </div>
        </div>
      )}
    </article>
  );
}

export default ReviewCard;