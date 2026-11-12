// client/src/components/PayoutVerifyModal.jsx
// mode="save"    -> asks for the CURRENT PASSWORD, then calls onConfirm({ currentPassword })
// mode="cashout" -> "Send code" (60s cooldown) + 6-digit email OTP, then onConfirm({ otp })
// onConfirm must return a promise that REJECTS with { message, code, ... } on failure.
import { useState } from "react";
import { Loader2, ShieldCheck, Mail, X } from "lucide-react";
import { sendPayoutOtp } from "../store/walletSlice";
import { useDispatch } from "react-redux";
import { useCooldown } from "../hooks/useCooldown";
import PasswordInput from "./PasswordInput";

function PayoutVerifyModal({ mode, amount, summaryText, onConfirm, onClose }) {
  const dispatch = useDispatch();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { left, start } = useCooldown();

  async function handleSendOtp() {
    setError(""); setNotice(""); setSending(true);
    try {
      const d = await dispatch(sendPayoutOtp(amount)).unwrap();
      setOtpSent(true);
      start(d.resendInSeconds ?? 60);
      setNotice("Code sent to your email. It expires in 5 minutes.");
    } catch (e) {
      setError(e.message);
      if (e.code === "OTP_COOLDOWN") start(e.retryAfter ?? 60);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(ev) {
    ev.preventDefault();
    setError(""); setBusy(true);
    try {
      await onConfirm(mode === "save" ? { currentPassword: password } : { otp });
      onClose();
    } catch (e) {
      setError(e.message);
      // Wrong/expired/locked OTP: make the user fetch a fresh one.
      if (["OTP_EXPIRED", "OTP_LOCKED", "OTP_NOT_REQUESTED", "OTP_ALREADY_USED"].includes(e.code)) { setOtp(""); setOtpSent(false); }
      if (e.code === "NETWORK") setError("We couldn't confirm the result. Check your wallet balance before trying again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = mode === "save" ? password.length > 0 : /^\d{6}$/.test(otp);

  return (
    <div className="modal modal-open z-100" role="dialog" aria-modal="true">
      <div className="modal-backdrop bg-neutral/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={handleConfirm} className="modal-box max-w-md rounded-3xl p-6 relative">
        <button type="button" onClick={onClose} disabled={busy} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"><X className="w-4 h-4" /></button>
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-6 h-6" /></div>
        <h3 className="font-extrabold text-xl text-center mb-1">{mode === "save" ? "Confirm it's you" : "Confirm withdrawal"}</h3>
        <p className="text-sm text-base-content/70 text-center mb-4">
          {mode === "save"
            ? "Enter your password to save this payout method. New destinations are locked for 24 hours."
            : summaryText}
        </p>

        {mode === "save" ? (
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Current password" autoFocus />
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={handleSendOtp} disabled={sending || left > 0} className="btn btn-outline btn-sm rounded-xl w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {left > 0 ? `Resend code in ${left}s` : otpSent ? "Resend code" : "Send code to my email"}
            </button>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
              disabled={!otpSent}
              className="input input-bordered w-full text-center tracking-[0.5em] font-bold text-lg"
            />
          </div>
        )}

        {notice && !error && <p className="text-success text-xs mt-3 font-medium text-center">{notice}</p>}
        {error && <div className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium mt-3">{error}</div>}

        <div className="flex gap-3 mt-5">
          <button type="button" className="btn btn-ghost flex-1 rounded-xl" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary flex-1 rounded-xl" disabled={busy || !canSubmit}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "save" ? "Save method" : "Confirm & cash out"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PayoutVerifyModal;
