// client/src/components/WorkerCard.jsx
import { Star, Navigation, Wrench, ShieldCheck } from "lucide-react";
import { formatDistance } from "../utils/format";

function WorkerCard({ worker }) {
  const name = worker.name || "Worker";

  return (
    <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 hover:-translate-y-1 p-4 sm:p-5 flex flex-col justify-between h-full">
      
      {/* Top Section: Avatar & Name */}
      <div className="flex items-start gap-3.5 mb-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-extrabold text-base flex items-center justify-center shrink-0 overflow-hidden border border-primary/10">
          {worker.avatarUrl ? (
            <img src={worker.avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-extrabold text-base text-base-content tracking-tight truncate">{name}</h2>
            {worker.verificationStatus === "verified" && (
              <ShieldCheck className="w-4 h-4 text-success shrink-0" title="Verified Worker" />
            )}
          </div>
          
          <p className="text-xs font-medium text-base-content/60 mt-0.5 line-clamp-1 flex items-center gap-1">
            <Wrench className="w-3 h-3 text-primary shrink-0" />
            {worker.skills?.length > 0 ? worker.skills.join(", ") : "No skills listed yet"}
          </p>
        </div>
      </div>

      {/* Metrics & Badges Footer */}
      <div className="pt-3 border-t border-base-200/60 flex flex-wrap items-center gap-2">
        {worker.rating != null ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/10 text-warning font-bold text-xs">
            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
            {worker.rating}
            {worker.ratingCount ? <span className="opacity-70 font-normal">({worker.ratingCount})</span> : ""}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-base-200/60 text-base-content/50 text-[11px] font-semibold">
            No reviews yet
          </span>
        )}

        {worker.distanceMeters != null && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base-200/60 text-base-content/70 text-[11px] font-semibold">
            <Navigation className="w-3 h-3 text-base-content/50" />
            {formatDistance(worker.distanceMeters)}
          </span>
        )}
      </div>
    </div>
  );
}

export default WorkerCard;