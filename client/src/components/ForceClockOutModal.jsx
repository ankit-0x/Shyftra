// client/src/components/ForceClockOutModal.jsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, AlertTriangle, Clock, Loader2 } from "lucide-react";

function toLocalDatetimeInputValue(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function ForceClockOutModal({ open, onConfirm, onCancel, isLoading }) {
  const [exitTime, setExitTime] = useState(() => toLocalDatetimeInputValue(new Date()));

  return (
    <AnimatePresence>
      {open && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-100" role="dialog" aria-modal="true">
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !isLoading && onCancel()}
          />
          <motion.div
            className="modal-box sm:max-w-md bg-base-100 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-error/10 text-error flex items-center justify-center shrink-0 border border-error/10">
                <LogOut className="w-5 h-5 ml-0.5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-xl text-base-content tracking-tight">Force Clock-Out</h3>
                <p className="text-sm text-base-content/60 leading-relaxed">
                  Worker left without a code? Enter their actual exit time below.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2.5 text-xs text-warning bg-warning/10 border border-warning/20 p-3.5 rounded-xl font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
              <span>This starts a 24-hour window during which the worker can dispute the time you enter.</span>
            </div>

            <div className="form-control mt-5">
              <label className="label text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1">
                Actual Exit Time
              </label>
              <div className="relative flex items-center">
                <Clock className="absolute left-3 w-4 h-4 text-base-content/40 pointer-events-none" />
                <input
                  type="datetime-local"
                  value={exitTime}
                  max={toLocalDatetimeInputValue(new Date())}
                  onChange={(e) => setExitTime(e.target.value)}
                  className="input input-bordered w-full pl-9 rounded-xl focus:outline-error/50 focus:border-error bg-base-100 text-sm"
                />
              </div>
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
                onClick={() => onConfirm(new Date(exitTime).toISOString())} 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Force Clock-Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ForceClockOutModal;