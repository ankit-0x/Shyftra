// client/src/components/admin/ForceLogoutModal.jsx
// Confirm dialog + admin password re-authentication for "Force logout".
import { useState } from "react";
import { useDispatch } from "react-redux";
import { LogOut, Loader2, X } from "lucide-react";
import { forceLogoutUser } from "../../store/adminSlice";

function ForceLogoutModal({ user, onClose }) {
  const dispatch = useDispatch();
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

    if (!user) return null; 

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await dispatch(forceLogoutUser({ userId: user._id, password, reason: reason.trim() || undefined })).unwrap();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to force logout");
      if (err.code === "WRONG_PASSWORD") setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-110" role="dialog" aria-modal="true" aria-label="Force logout">
      <div className="modal-backdrop bg-neutral/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="modal-box sm:max-w-md bg-base-100 p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative">
        <button type="button" onClick={onClose} disabled={busy} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-error/10 text-error">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1 pr-6">
            <h3 className="font-extrabold text-lg">Force logout?</h3>
            <p className="text-sm text-base-content/70 leading-relaxed">
              <strong>{user.name}</strong> will be signed out of every device on their next request. They can log in again with their password.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">Your admin password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className={`input input-bordered w-full bg-base-100 ${error ? "input-error" : ""}`}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider" htmlFor="fl-reason">
              Reason (optional, kept in the audit log)
            </label>
            <input
              id="fl-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              className="input input-bordered w-full bg-base-100"
              placeholder="e.g. reported stolen phone"
            />
          </div>
          {error && (
            <div role="alert" className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="modal-action pt-4 mt-5 border-t border-base-200 flex gap-2">
          <button type="button" className="btn btn-ghost flex-1 rounded-xl" onClick={onClose} disabled={busy}>
            Never mind
          </button>
          <button type="submit" className="btn btn-error flex-1 rounded-xl font-bold" disabled={busy || password.length === 0}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Force logout
          </button>
        </div>
      </form>
    </div>
  );
}

export default ForceLogoutModal;