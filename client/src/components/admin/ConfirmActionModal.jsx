// client/src/components/admin/ConfirmActionModal.jsx
import { AlertTriangle, AlertCircle, CheckCircle, Info } from "lucide-react";

const VARIANT_CONFIG = {
  warning: {
    btnClass: "btn-warning",
    icon: AlertTriangle,
    iconColor: "text-warning",
    bgColor: "bg-warning/10",
  },
  error: {
    btnClass: "btn-error",
    icon: AlertCircle,
    iconColor: "text-error",
    bgColor: "bg-error/10",
  },
  success: {
    btnClass: "btn-success",
    icon: CheckCircle,
    iconColor: "text-success",
    bgColor: "bg-success/10",
  },
  primary: {
    btnClass: "btn-primary",
    icon: Info,
    iconColor: "text-primary",
    bgColor: "bg-primary/10",
  },
};

function ConfirmActionModal({
  open,
  title = "Are you sure?",
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning", // "warning" | "error" | "success" | "primary"
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.warning;
  const Icon = config.icon;

  return (
    <dialog
      className="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-box sm:max-w-md p-6 rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          {/* Dynamic Icon Indicator */}
          <div
            className={`shrink-0 p-3 rounded-full ${config.bgColor} ${config.iconColor}`}
          >
            <Icon className="w-6 h-6" />
          </div>

          {/* Text Content */}
          <div className="mt-1 flex-1">
            <h3 className="font-bold text-lg text-base-content">{title}</h3>
            {body && (
              <div className="mt-2 text-sm text-base-content/70 leading-relaxed">
                {body}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action mt-6 gap-2">
          <button
            type="button"
            className="btn btn-ghost hover:bg-base-200"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${config.btnClass} min-w-24`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>

      {/* Backdrop to close when clicking outside */}
      <form
        method="dialog"
        className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
        onClick={onCancel}
      >
        <button type="button" aria-label="Close modal">
          close
        </button>
      </form>
    </dialog>
  );
}

export default ConfirmActionModal;