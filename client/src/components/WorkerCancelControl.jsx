// client/src/components/WorkerCancelControl.jsx
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useApiQuery } from "../hooks/useApiQuery";
import { useLiveTick } from "../hooks/useLiveTick";
import { cancelActionFor } from "../utils/applicationStatus";
import { withdrawApplication, workerCancelApplication } from "../store/applicationsSlice";

const REASONS = [
  "Something came up",
  "Found other work",
  "Health or family emergency",
  "Transport problem",
  "Applied by mistake",
];
const OTHER = "__other__";

const CONFIRM_CLASS = { 
  free: "btn-success shadow-success/20", 
  strike: "btn-warning shadow-warning/20", 
  ban: "btn-error shadow-error/20", 
  withdraw: "btn-primary shadow-primary/20" 
};

function CancelDialog({ app, action, onClose }) {
  const dispatch = useDispatch();
  const shiftId = app.shift?._id;
  const isCancel = action === "cancel";

    // ✅ NEW: Refresh preview if the shift changes
  const shiftTick = useLiveTick("shifts:changed", shiftId); 

  const { data: preview, loading, error } = useApiQuery(
    `/api/shifts/${shiftId}/applications/${app._id}/cancel-preview`,
    {},
    isCancel,
    { expect: "object", refreshToken: shiftTick }, // ✅ Add refreshToken
  );

  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    boxRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const reason = (choice === OTHER ? custom : choice).trim().slice(0, 500);
  const willBan = isCancel && preview?.willBeBanned;
  const kind = !isCancel ? "withdraw" : willBan ? "ban" : preview?.free ? "free" : "strike";
  const labels = {
    withdraw: "Withdraw Application",
    free: "Cancel Shift (No Strike)",
    strike: "Cancel & Take Strike",
    ban: "Cancel & Suspend Account",
  };
  const canConfirm = !busy && (!isCancel || (preview && !error)) && (!willBan || understood);

  async function confirm() {
    setBusy(true);
    const thunk = isCancel ? workerCancelApplication : withdrawApplication;
    const result = await dispatch(thunk({ shiftId, applicationId: app._id, reason: reason || undefined }));
    setBusy(false);
    if (thunk.fulfilled.match(result)) onClose();
  }

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <motion.div
        className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => !busy && onClose()}
      />
      <motion.div
        ref={boxRef}
        tabIndex={-1}
        className="modal-box sm:max-w-md bg-base-100 p-6 sm:p-7 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative outline-none space-y-4"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div>
          <h3 id="cancel-title" className="font-extrabold text-lg sm:text-xl text-base-content tracking-tight">
            {isCancel ? "Cancel this shift?" : "Withdraw your application?"}
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-primary mt-1 truncate">{app.shift?.title}</p>
        </div>

        {!isCancel && (
          <p className="text-xs sm:text-sm text-base-content/70 leading-relaxed bg-base-200/40 p-3 rounded-xl border border-base-200/60">
            The employer will no longer see your application. No strike or penalty is involved. You can apply again while the shift is open.
          </p>
        )}

        {isCancel && loading && (
          <div className="h-28 w-full bg-base-200/60 rounded-2xl animate-pulse" aria-busy="true" />
        )}

        {isCancel && error && (
          <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-3.5 text-xs font-semibold text-error flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isCancel && preview && !error && (
          <div className="space-y-3">
            {preview.free ? (
              <div className="rounded-xl border border-success/20 bg-success/10 p-3.5 text-xs flex gap-3 text-success-content">
                <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  <strong>Free cancellation.</strong> The shift starts in about {Math.round(preview.hoursUntilStart)}h and you're cancelling at least {preview.freeCancelHours}h ahead. <strong className="text-success font-extrabold">No strike.</strong>
                </p>
              </div>
            ) : (
              <div className={`rounded-xl border p-3.5 text-xs flex gap-3 ${willBan ? "border-error/30 bg-error/10 text-error-content" : "border-warning/30 bg-warning/10 text-warning-content"}`}>
                <AlertTriangle size={18} className={`${willBan ? "text-error" : "text-warning"} shrink-0 mt-0.5`} aria-hidden="true" />
                <div className="space-y-1.5 leading-relaxed">
                  <p>
                    <strong className="font-extrabold">This will cost you a strike</strong> —{" "}
                    {preview.alreadyArrived
                      ? "you've already checked in at the location."
                      : preview.freeCancelHours > 0
                        ? `free cancellation needs at least ${preview.freeCancelHours}h notice and the shift starts in about ${Math.round(preview.hoursUntilStart)}h.`
                        : "cancelling an accepted shift always costs a strike."}
                  </p>
                  <p className="font-semibold">
                    Strikes: <span className="underline">{preview.strikes}/{preview.banThreshold}</span> →{" "}
                    <span className="font-bold">{preview.strikesAfter}/{preview.banThreshold}</span>
                  </p>
                  {willBan && (
                    <p className="font-extrabold text-error pt-1">
                      This is strike {preview.banThreshold}: your account will be suspended immediately and you will lose access.
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="text-[11px] font-medium text-base-content/50">
              The employer's escrowed payment will be refunded in full and the shift reopened.
            </p>
          </div>
        )}

        {(!isCancel || (preview && !error)) && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider" htmlFor="cancel-reason">
              Reason <span className="font-normal text-base-content/45 lowercase">(optional)</span>
            </label>
            <select 
              id="cancel-reason" 
              className="select select-bordered select-sm w-full rounded-xl text-xs focus:outline-primary/20 focus:border-primary" 
              value={choice} 
              onChange={(e) => setChoice(e.target.value)} 
              disabled={busy}
            >
              <option value="">Prefer not to say</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value={OTHER}>Other…</option>
            </select>
            {choice === OTHER && (
              <textarea 
                className="textarea textarea-bordered w-full rounded-xl text-xs focus:outline-primary/20 focus:border-primary h-20 resize-none mt-2" 
                maxLength={500} 
                placeholder="Tell the employer what happened..."
                value={custom} 
                onChange={(e) => setCustom(e.target.value)} 
                disabled={busy} 
              />
            )}
          </div>
        )}

        {willBan && (
          <label className="flex items-start gap-2.5 text-xs font-medium text-error cursor-pointer bg-error/5 p-3 rounded-xl border border-error/20">
            <input 
              type="checkbox" 
              className="checkbox checkbox-error checkbox-xs rounded mt-0.5" 
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)} 
              disabled={busy} 
            />
            <span>I understand and accept that my account will be suspended.</span>
          </label>
        )}

        <div className="modal-action pt-3 mt-4 border-t border-base-200 flex gap-2">
          <button 
            type="button" 
            className="btn btn-ghost flex-1 rounded-xl" 
            onClick={onClose} 
            disabled={busy}
          >
            Never mind
          </button>
          {(!isCancel || !error) && (
            <button 
              type="button" 
              className={`btn btn-sm sm:btn-md flex-1 rounded-xl shadow-sm font-bold text-xs sm:text-sm gap-2 ${CONFIRM_CLASS[kind]}`} 
              onClick={confirm} 
              disabled={!canConfirm}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {labels[kind]}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function WorkerCancelControl({ app, className = "btn btn-xs sm:btn-sm btn-ghost btn-outline border-error/30 text-error hover:bg-error/10 rounded-xl gap-1" }) {
  const [open, setOpen] = useState(false);
  const action = cancelActionFor(app);
  if (!action) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <XCircle className="w-3.5 h-3.5" />
        <span>{action === "withdraw" ? "Withdraw" : "Cancel Shift"}</span>
      </button>
      <AnimatePresence>
        {open && <CancelDialog app={app} action={action} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

export default WorkerCancelControl;