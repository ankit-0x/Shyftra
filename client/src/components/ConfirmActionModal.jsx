// client/src/components/ConfirmActionModal.jsx
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info, AlertCircle, Loader2 } from "lucide-react";

// Explicit lookup rather than `btn-${variant}` template interpolation —
// Tailwind's build-time scanner needs to see each class as a complete,
// literal string somewhere in source. A dynamically-built class name can
// silently fail to make it into the production CSS bundle even though it
// works fine in dev — a genuinely nasty class of bug to debug later.
const VARIANT_CLASSES = { 
  primary: "btn-primary shadow-md shadow-primary/20", 
  error: "btn-error shadow-md shadow-error/20", 
  warning: "btn-warning shadow-md shadow-warning/20" 
};

const VARIANT_ICONS = {
  primary: { icon: Info, bg: "bg-primary/10 text-primary" },
  error: { icon: AlertTriangle, bg: "bg-error/10 text-error" },
  warning: { icon: AlertCircle, bg: "bg-warning/10 text-warning" }
};

function ConfirmActionModal({ open, title, body, confirmLabel, variant = "primary", isLoading, onConfirm, onCancel }) {
  const IconConfig = VARIANT_ICONS[variant] || VARIANT_ICONS.primary;
  const Icon = IconConfig.icon;

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
            className="modal-box sm:max-w-md bg-base-100 p-6 sm:p-7 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${IconConfig.bg}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-extrabold text-lg text-base-content tracking-tight">{title}</h3>
                <p className="text-sm text-base-content/70 leading-relaxed">{body}</p>
              </div>
            </div>

            <div className="modal-action pt-4 mt-6 border-t border-base-200 flex gap-2">
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
                className={`btn flex-1 rounded-xl font-bold ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary}`} 
                onClick={onConfirm} 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmActionModal;