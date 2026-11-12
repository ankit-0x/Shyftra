// client/src/components/StarRating.jsx
// Read-only star display (1–5). Supports whole stars; `value` is rounded.
import { Star } from "lucide-react";

function StarRating({ value = 0, size = 14, className = "" }) {
  const rounded = Math.round(value);
  
  return (
    <span 
      className={`inline-flex items-center gap-0.5 ${className}`} 
      role="img" 
      aria-label={`${Number(value).toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const isActive = n <= rounded;
        return (
          <Star
            key={n}
            size={size}
            aria-hidden="true"
            className={`transition-colors ${
              isActive 
                ? "text-warning fill-warning drop-shadow-sm" 
                : "text-base-300 fill-base-200/50"
            }`}
          />
        );
      })}
    </span>
  );
}

export default StarRating;