// client/src/components/ShiftCard.jsx
import { Link } from "react-router";
import { MapPin, IndianRupee, Clock, Star, Building2, Navigation, Wrench } from "lucide-react";
import { formatDistance, formatStartsIn } from "../utils/format";

function ShiftCard({ shift }) {
  const skillsList = Array.isArray(shift.skillRequired)
    ? shift.skillRequired
    : shift.skillRequired
    ? [shift.skillRequired]
    : [];

  return (
    <Link
      to={`/shifts/${shift._id}`}
      className="group relative flex h-full flex-col bg-base-100 rounded-2xl border border-base-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] p-4 sm:p-5"
    >
      {/* Header — one line, fixed height */}
      <div className="flex items-center justify-between gap-2 mb-2 min-h-5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-base-content/50">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <p className="text-[11px] font-bold uppercase tracking-wider truncate">
            {shift.employer?.businessName || "Unknown Employer"}
          </p>
        </div>
        {shift.employer?.rating != null && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-md shrink-0">
            <Star className="w-3 h-3 fill-warning text-warning" />
            {shift.employer.rating}
          </span>
        )}
      </div>

      {/* Title — clamp 2 lines AND reserve 2-line height so 1-line titles don't shrink the card */}
      <h2 className="text-base sm:text-lg font-extrabold text-base-content leading-snug line-clamp-2 mb-3 min-h-12 sm:min-h-14">
        {shift.title}
      </h2>

      {/* Metrics — reserve one row height so few badges don't collapse the row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 min-h-8">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
          <IndianRupee className="w-3.5 h-3.5 shrink-0" />
          {(shift.hourlyPay / 100).toFixed(0)}/hr
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200/60 border border-base-200 text-base-content/70 text-[11px] font-semibold uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {formatStartsIn(shift.startTime)}
        </span>

        {skillsList.slice(0, 2).map((skill, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200/60 border border-base-200 text-base-content/70 text-[11px] font-semibold tracking-wide truncate max-w-32"
            title={skill}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            {skill}
          </span>
        ))}

        {skillsList.length > 2 && (
          <span
            className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-base-200/60 border border-base-200 text-base-content/70 text-[11px] font-bold shrink-0"
            title={skillsList.slice(2).join(", ")}
          >
            +{skillsList.length - 2}
          </span>
        )}

        {shift.distanceMeters != null && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-200/60 border border-base-200 text-base-content/70 text-[11px] font-semibold uppercase tracking-wide">
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            {formatDistance(shift.distanceMeters)}
          </span>
        )}
      </div>

      {/* Address — sticks to bottom of the card */}
      <div className="mt-auto pt-3 border-t border-base-200/60 flex items-start gap-2 text-xs font-medium text-base-content/60">
        <MapPin className="w-3.5 h-3.5 shrink-0 text-base-content/40 mt-0.5" />
        <span className="line-clamp-1 wrap-break-word leading-relaxed">{shift.address}</span>
      </div>
    </Link>
  );
}

export default ShiftCard;