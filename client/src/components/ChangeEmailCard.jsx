// client/src/components/ChangeEmailCard.jsx   (used inside pages/Profile.jsx)
// Three-step card: idle -> form (new email + current password) -> code (6 digits).
// Matches the ChangePasswordCard pattern (RHF + zod + PasswordInput + toast).
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Mail, Loader2, Info, ShieldCheck } from "lucide-react";
import {
  requestEmailChange,
  resendEmailChange,
  verifyEmailChange,
} from "../store/authSlice";
import { socket } from "../socket";
import { useCooldown } from "../hooks/useCooldown";
import PasswordInput from "./PasswordInput";
import OtpInput from "./OtpInput";

const formSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your new email")
    .email("Please enter a valid email address")
    .max(254),
  currentPassword: z
    .string()
    .min(1, "Enter your current password")
    .max(128),
});

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="text-error text-xs mt-1 font-medium">{error.message}</p>}
    </div>
  );
}

function ChangeEmailCard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [step, setStep] = useState("idle"); // idle | form | code
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpReset, setOtpReset] = useState(0); // bump -> OtpInput remounts with empty boxes
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState("");
  const { left, start } = useCooldown();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(formSchema) });

  function cancel() {
    reset();
    setPendingEmail("");
    setCodeError("");
    setStep("idle");
  }

  async function onSubmit(values) {
    try {
      const d = await dispatch(requestEmailChange(values)).unwrap();
      setPendingEmail(values.newEmail);
      setCodeError("");
      start(d.resendInSeconds ?? 60);
      setStep("code");
    } catch (e) {
      if (e?.code === "WRONG_CURRENT_PASSWORD") {
        setError("currentPassword", { message: e.message });
      } else if (e?.code === "SAME_EMAIL") {
        setError("newEmail", { message: e.message });
      } else if (e?.code === "OTP_COOLDOWN") {
        toast.error(e.message);
      } else {
        toast.error(e?.message || "Could not send the code");
      }
    }
  }

  async function handleCode(code) {
    if (verifying) return;
    setVerifying(true);
    setCodeError("");
    try {
      await dispatch(verifyEmailChange(code)).unwrap();
      toast.success("Email updated. Your other devices were logged out.");
      // The server closed every socket (including ours) and issued fresh
      // cookies with a new tv. Reconnect so live updates keep working.
      socket.disconnect();
      socket.connect();
      cancel();
    } catch (e) {
      setCodeError(e?.message || "Could not verify the code");
      setOtpReset((n) => n + 1); // clear the boxes
      if (
        ["OTP_EXPIRED", "OTP_LOCKED", "OTP_NOT_REQUESTED", "OTP_ALREADY_USED", "EMAIL_CHANGE_CONFLICT"]
          .includes(e?.code)
      ) {
        // This code is dead — send the user back to step 1.
        setStep("form");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setCodeError("");
    try {
      const d = await dispatch(resendEmailChange()).unwrap();
      start(d.resendInSeconds ?? 60);
      setOtpReset((n) => n + 1);
      toast.success("If the address can be used, a new code is on its way.");
    } catch (e) {
      if (e?.code === "OTP_COOLDOWN") start(e.retryAfter ?? 60);
      if (e?.code === "OTP_NOT_REQUESTED") setStep("form");
      setCodeError(e?.message || "Could not resend the code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
      <div className="p-6 border-b border-base-200 bg-base-200/30">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> Email address
        </h3>
      </div>

      {step === "idle" && (
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">
              Current email
            </p>
            <p className="font-semibold truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline rounded-xl"
            onClick={() => setStep("form")}
          >
            Change email
          </button>
        </div>
      )}

            {step === "form" && (
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
          {codeError && (
            <div
              role="alert"
              className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium"
            >
              {codeError}
            </div>
          )}
          <Field label="New email" error={errors.newEmail}>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...register("newEmail")}
              className={`input input-bordered w-full bg-base-100 ${errors.newEmail ? "input-error" : ""}`}
            />
          </Field>
          <Field label="Current password" error={errors.currentPassword}>
            <PasswordInput
              {...register("currentPassword")}
              autoComplete="current-password"
              error={errors.currentPassword}
            />
          </Field>
          <div className="flex items-start gap-2 text-xs text-base-content/60 bg-info/5 border border-info/20 rounded-xl p-3">
            <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
            We'll send a 6-digit code to the new address. Once you confirm it,
            your other devices are signed out and we notify your old address.
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost rounded-xl"
              onClick={cancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary rounded-xl sm:px-8"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Sending…" : "Send code"}
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-sm text-base-content/70 leading-relaxed">
              If{" "}
              <strong className="text-base-content break-all">{pendingEmail}</strong>{" "}
              can be used, we sent it a 6-digit code. It expires in 10 minutes.
            </p>
          </div>

          <div className="flex justify-center py-1" aria-busy={verifying}>
            <OtpInput onComplete={handleCode} disabled={verifying} reset={otpReset} />
          </div>

          {verifying && (
            <p className="text-center text-xs text-base-content/60 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…
            </p>
          )}

          {codeError && (
            <div
              role="alert"
              className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium text-center"
            >
              {codeError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-xl"
              onClick={cancel}
              disabled={verifying}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm rounded-xl"
              onClick={handleResend}
              disabled={resending || verifying || left > 0}
            >
              {resending && <Loader2 className="w-4 h-4 animate-spin" />}
              {left > 0 ? `Resend code in ${left}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeEmailCard;