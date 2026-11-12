// client/src/components/RatingModal.jsx
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Loader2, MessageSquare } from "lucide-react";

// Holds the star/comment state. It is only mounted while the modal is open,
// so every opening starts from a blank form without any reset effect.
function RatingForm({ revieweeName, onSubmit, onCancel, isLoading }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <>
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center mb-3">
          <Star className="w-6 h-6 text-warning fill-warning" />
        </div>
        <h3 className="font-extrabold text-xl text-base-content tracking-tight">
          {revieweeName ? `Rate ${revieweeName}` : "Rate this shift"}
        </h3>
        <p className="text-sm text-base-content/60 mt-1">
          Your feedback helps build trust in the community.
        </p>
      </div>

      <div className="flex justify-center gap-1.5 sm:gap-2 my-6">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = (hoverRating || rating) >= star;
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className={`transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                isActive ? "drop-shadow-md" : ""
              }`}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              <Star 
                className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors duration-200 ${
                  isActive 
                    ? "text-warning fill-warning" 
                    : "text-base-300 fill-base-200 hover:fill-base-300"
                }`} 
              />
            </button>
          );
        })}
      </div>

      <div className="relative mt-2">
        <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
        <textarea
          value={comment}
          maxLength={500}
          disabled={isLoading}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional — add a comment about your experience..."
          className="textarea textarea-bordered w-full pl-10 rounded-xl focus:outline-primary/20 focus:border-primary text-sm h-24 resize-none leading-relaxed bg-base-100"
        />
        <div className="text-right mt-1">
          <span className="text-[10px] font-medium text-base-content/40">
            {comment.length}/500
          </span>
        </div>
      </div>

      <div className="modal-action pt-2 mt-4 border-t border-base-200 flex gap-3">
        <button 
          type="button" 
          className="btn btn-ghost flex-1 rounded-xl" 
          onClick={onCancel} 
          disabled={isLoading}
        >
          Skip
        </button>
        <button 
          type="button" 
          className="btn btn-primary flex-1 rounded-xl shadow-md shadow-primary/20 font-bold gap-2" 
          onClick={() => onSubmit({ rating, comment: comment.trim() })} 
          disabled={isLoading || rating === 0}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit Rating
        </button>
      </div>
    </>
  );
}

function RatingModal({ open, revieweeName, onSubmit, onCancel, isLoading }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLoading, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true">
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !isLoading && onCancel()}
          />
          <motion.div
            className="modal-box sm:max-w-md bg-base-100 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative text-center"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <RatingForm
              revieweeName={revieweeName}
              onSubmit={onSubmit}
              onCancel={onCancel}
              isLoading={isLoading}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default RatingModal;