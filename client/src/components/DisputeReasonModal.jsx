// client/src/components/DisputeReasonModal.jsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, Loader2, AlertCircle } from "lucide-react";

function DisputeReasonModal({ open, onSubmit, onCancel, isLoading, employerExitTime }) {
  const [reason, setReason] = useState("");
  
  const [claimedTime, setClaimedTime] = useState(() => {
    if (!employerExitTime) return "";
    const d = new Date(employerExitTime);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  });
  
  const tooShort = reason.trim().length < 10;

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
            className="modal-box sm:max-w-lg bg-base-100 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-xl text-base-content tracking-tight">Dispute this exit time</h3>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  Explain what actually happened. Your employer will have 48 hours to upload proof, or you'll be paid in full automatically.
                </p>
              </div>
            </div>

            {/* 👇 NAYA TIME INPUT */}
            <div className="form-control mt-5">
              <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                What time did you actually leave? <span className="text-error">*</span>
              </label>
              <input
                type="datetime-local"
                value={claimedTime}
                onChange={(e) => setClaimedTime(e.target.value)}
                max={new Date().toISOString().slice(0, 16)}
                className="input input-bordered w-full text-sm focus:outline-error/50 focus:border-error bg-base-100"
              />
            </div>

            <div className="form-control mt-4">
              <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                Reason for dispute <span className="text-error">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. I actually left at 6pm, not 4pm — I sent a text confirming this..."
                className="textarea textarea-bordered w-full h-24 focus:outline-error/50 focus:border-error bg-base-100 text-sm resize-none"
              />
              {tooShort && reason.length > 0 && (
                <div className="flex items-center gap-1.5 text-error text-xs mt-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Please provide at least 10 characters explaining the situation.</span>
                </div>
              )}
            </div>

            <div className="modal-action pt-4 mt-6 border-t border-base-200 flex gap-3">
              <button 
                type="button" 
                className="btn btn-ghost flex-1 rounded-xl" 
                onClick={onCancel} 
                disabled={isLoading}
              >
                Never mind
              </button>
              <button 
                type="button" 
                className="btn btn-error flex-1 rounded-xl shadow-md shadow-error/20 font-bold gap-2" 
                onClick={() => onSubmit({ reason, claimedTime: new Date(claimedTime).toISOString() })} 
                disabled={isLoading || tooShort || !claimedTime}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Dispute
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default DisputeReasonModal;