// client/src/components/ConfirmShiftPostModal.jsx
import { AnimatePresence, motion } from "framer-motion";
import { Info, AlertTriangle, Check, Loader2 } from "lucide-react";
import { PLATFORM_FEE_FLAT } from "../constants/businessRule";

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function findSimilarShift(myShifts, newData) {
  if (!myShifts || !newData) return null;
  const IGNORE_STATUSES = ["cancelled", "completed", "expired"];

  const newTitle = (newData.title || "").trim().toLowerCase();
  if (!newTitle) return null;

  const newStart = new Date(newData.startTime).getTime();
  const newEnd = new Date(newData.endTime).getTime();
  if (!Number.isFinite(newStart) || !Number.isFinite(newEnd)) return null;

  for (const s of myShifts) {
    if (IGNORE_STATUSES.includes(s.status)) continue;
    const sameTitle = (s.title || "").trim().toLowerCase() === newTitle;
    if (!sameTitle) continue;

    const sStart = new Date(s.startTime).getTime();
    const sEnd = new Date(s.endTime).getTime();
    const overlaps = newStart < sEnd && newEnd > sStart;
    if (overlaps) return s;
  }
  return null;
}

function ConfirmShiftPostModal({
  open,
  data,
  myShifts = [],
  isLoading,
  onConfirm,
  onCancel,
}) {
  if (!open || !data) return null;

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  const hours = (end - start) / (1000 * 60 * 60);
  const hoursValid = Number.isFinite(hours) && hours > 0;
  const workers = Number(data.workersNeeded) || 1;

  const payPaise = Number(data.hourlyPay) || 0;
  const payRupees = payPaise / 100;
  const maxCost = hoursValid
    ? +((hours * payPaise * workers) / 100).toFixed(2)
    : null;

  const similar = findSimilarShift(myShifts, data);
  
  // Array Handling for Skills
  const skillsText = Array.isArray(data.skillRequired) 
    ? data.skillRequired.join(", ") 
    : (data.skillRequired || "None");

  return (
    <AnimatePresence>
      {open && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle z-110"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
          />
          <motion.div
            className="modal-box sm:max-w-md bg-base-100 p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div>
              <h3 className="font-extrabold text-lg text-base-content tracking-tight">
                Confirm shift details
              </h3>
              <p className="text-xs text-base-content/60 mt-0.5">
                Review details before the platform fee is charged.
              </p>
            </div>

            {/* Similar shift warning */}
            {similar && (
              <div className="mt-3 flex items-start gap-2.5 bg-warning/10 border border-warning/20 p-3 rounded-xl text-warning-content">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-warning">
                    Possible duplicate shift
                  </p>
                  <p className="text-base-content/80 leading-snug">
                    Active shift <strong>"{similar.title}"</strong> overlaps
                    with these times.
                  </p>
                </div>
              </div>
            )}

            <div className="divider my-2.5" />

            <dl className="space-y-2 text-xs sm:text-sm">
              <Row label="Title" value={data.title} />
              <Row label="Skills" value={skillsText} /> {/* <--- Yahan skillsText use kiya hai */}
              <Row label="Hourly Pay" value={`${inr(payRupees)}/hr`} />
              <Row label="Workers" value={workers} />
              <Row label="Start" value={formatDateTime(data.startTime)} />
              <Row label="End" value={formatDateTime(data.endTime)} />
              {hoursValid && (
                <Row label="Duration" value={`${+hours.toFixed(2)} hrs`} />
              )}
              <Row label="Address" value={data.address} multiline />
            </dl>

            {data.locationIsDefault && (
              <div className="mt-3 flex items-start gap-2.5 bg-warning/10 border border-warning/20 p-3 rounded-xl text-warning-content">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-warning">
                    Using default location
                  </p>
                  <p className="text-base-content/80 leading-snug">
                    Your browser blocked precise location, so this shift will
                    use <strong>Mumbai (19.076° N, 72.878° E)</strong> for
                    worker matching. Workers near the written address may not
                    see it.
                  </p>
                </div>
              </div>
            )}

            <div className="divider my-2.5" />

            <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs flex gap-2.5 text-base-content/80">
              <Info className="w-4 h-4 shrink-0 text-warning mt-0.5" />
              <div className="space-y-1 leading-snug">
                <p>
                  Platform fee:{" "}
                  <strong className="text-base-content">
                    {inr(PLATFORM_FEE_FLAT)}
                  </strong>{" "}
                  (charged now)
                </p>
                {maxCost != null && (
                  <p>
                    Max escrow:{" "}
                    <strong className="text-base-content">
                      {inr(maxCost)}
                    </strong>{" "}
                    (locked as workers join)
                  </p>
                )}
              </div>
            </div>

            <div className="modal-action pt-3 mt-4 border-t border-base-200 flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost flex-1 rounded-xl text-xs"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm flex-1 rounded-xl font-bold text-xs gap-1.5 ${similar ? "btn-warning shadow-sm shadow-warning/20" : "btn-primary shadow-sm shadow-primary/20"}`}
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {!isLoading &&
                  (similar ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  ))}
                {similar ? "Post Anyway" : "Confirm & Post"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, multiline }) {
  return (
    <div
      className={
        multiline ? "space-y-0.5" : "flex justify-between items-center gap-2"
      }
    >
      <dt className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider">
        {label}
      </dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap text-xs text-base-content/80 bg-base-200/50 p-2 rounded-lg border border-base-200"
            : "font-semibold text-base-content text-right text-xs truncate max-w-50"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export default ConfirmShiftPostModal;