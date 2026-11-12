// client/src/pages/ForgotPassword.jsx   route: /forgot-password
import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Helmet } from "react-helmet-async";
import { Mail, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { requestPasswordReset, apiError } from "../api/authApi";
import { useCooldown } from "../hooks/useCooldown";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Please enter a valid email address") });

function ForgotPassword() {
  const [sentTo, setSentTo] = useState(null);
  const [serverError, setServerError] = useState("");
  const { left, start } = useCooldown();
   const [resending, setResending] = useState(false); 
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  async function onSubmit({ email }) {
    setServerError("");
    try {
      await requestPasswordReset(email);
      setSentTo(email);
      start(60);
    } catch (err) {
      const e = apiError(err);
      setServerError(e.message);
      if (e.status === 429) start(60);
    }
  }

  async function resend() {                            // ← add
    setResending(true);
    await onSubmit({ email: sentTo });
    setResending(false);
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <Helmet><title>Forgot password · Shyftra</title></Helmet>
      <div className="w-full max-w-md bg-base-100 rounded-3xl border border-base-200 shadow-sm p-8">
        {sentTo ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-4"><MailCheck className="w-7 h-7" /></div>
            <h1 className="font-extrabold text-2xl mb-2">Check your email</h1>
            {/* Same wording whether or not the account exists (no enumeration). */}
            <p className="text-sm text-base-content/70 mb-6">
              If an account exists for <strong>{sentTo}</strong>, we've sent a reset link. It expires in 20 minutes.
            </p>
            <button className="btn btn-outline btn-sm rounded-xl w-full mb-3" disabled={left > 0 || resending} onClick={resend}>
               {left > 0 ? `Resend in ${left}s` : resending ? "Sending…" : "Send again"}
            </button>
            <Link to="/" className="text-sm font-bold text-primary hover:underline">Back to home</Link>
          </div>
        ) : (
          <>
            <h1 className="font-extrabold text-2xl mb-1">Forgot password?</h1>
            <p className="text-sm text-base-content/60 mb-5">Enter your email and we'll send you a link to reset it.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <div>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-base-content/40" />
                  <input {...register("email")} type="email" autoComplete="email" placeholder="name@example.com" className="input input-bordered w-full pl-10 bg-base-100" />
                </div>
                {errors.email && <p className="text-error text-xs mt-1 font-medium">{errors.email.message}</p>}
              </div>
              {serverError && <div className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium">{serverError}</div>}
              <button type="submit" disabled={isSubmitting || left > 0} className="btn btn-primary w-full rounded-xl">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {left > 0 ? `Try again in ${left}s` : "Send reset link"}
              </button>
            </form>
            <Link to="/" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"><ArrowLeft className="w-4 h-4" /> Back</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
