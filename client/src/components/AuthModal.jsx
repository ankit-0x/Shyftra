// client/src/components/AuthModal.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  HardHat,
  Briefcase,
  ShieldAlert,
  Loader2,
  ArrowRight,
  MailCheck,
} from "lucide-react";
import {
  closeAuthModal,
  switchAuthMode,
  clearPendingAction,
} from "../store/authModalSlice";
import {
  loginUser,
  registerUser,
  clearAuthError,
  clearPendingVerification,
} from "../store/authSlice";
import { passwordSchema } from "../schemas/password";
import ResendVerification from "./ResendVerification";
import { runProtectedAction } from "../utils/runProtectedAction";
import { PLATFORM_FEE_FLAT } from "../constants/businessRule";
import { TopupPromptContent } from "./TopupPromptModal";

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "Name must be at least 3 characters long" })
    .max(50, { message: "Name cannot exceed 50 characters" })
    .regex(/^[a-zA-Z\s\-']+$/, {
      message:
        "Name can only contain letters, spaces, hyphens, and apostrophes",
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please enter a valid email address" }),
  password: passwordSchema, // shared rule: src/schemas/password.js
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, {
      message:
        "Phone must be a valid international number (e.g. +919876543210)",
    }),
  role: z.enum(["worker", "employer"], {
    errorMap: () => ({ message: "Role must be either 'worker' or 'employer'" }),
  }),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please enter a valid email address" })
    .min(1),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password is too long" }),
});

function AuthForm({ mode, pendingAction, onSuccess }) {
  const dispatch = useDispatch();
  const { error, errorCode, errorEmail, status } = useSelector(
    (state) => state.auth,
  );
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mode === "login" ? loginSchema : signupSchema),
    defaultValues: { role: pendingAction?.inferredRole || "worker" },
  });

  const watchedRole = useWatch({ control, name: "role" });
  const selectedRole = mode === "signup" ? watchedRole : null;

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  async function onSubmit(data) {
    const action = mode === "login" ? loginUser(data) : registerUser(data);
    const result = await dispatch(action);

    // Signup no longer logs the user in: the store sets pendingVerificationEmail
    // and AuthModal swaps this form for the "check your email" panel.
    if (mode === "login" && result.type.endsWith("/fulfilled")) {
      onSuccess(result.payload, pendingAction);
    }
  }

  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <h3 className="font-extrabold text-2xl text-base-content tracking-tight">
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h3>
        <p className="text-xs sm:text-sm text-base-content/60 mt-1">
          {mode === "login"
            ? "Log in to manage your shifts and wallet."
            : "Join Shyftra in under a minute."}
        </p>
      </div>

      {pendingAction && (
        <div className="flex items-center gap-2 text-xs bg-info/10 text-info border border-info/20 rounded-xl p-2.5 mb-3 font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Just one quick step, then we'll finish what you were doing.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {mode === "signup" && (
          <>
            <div className="form-control">
              <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0 mb-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-base-content/40" />
                <input
                  {...register("name")}
                  placeholder="John Doe"
                  autoComplete="name"
                  className="input input-bordered input-sm sm:input-md w-full pl-10 focus:outline-primary/50 focus:border-primary bg-base-100"
                />
              </div>
              {errors.name && (
                <p className="text-error text-xs mt-1 font-medium">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="form-control">
              <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0 mb-1">
                Phone Number
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3 w-4 h-4 text-base-content/40" />
                <input
                  {...register("phone")}
                  placeholder="+919876543210"
                  autoComplete="tel"
                  className="input input-bordered input-sm sm:input-md w-full pl-10 focus:outline-primary/50 focus:border-primary bg-base-100"
                />
              </div>
              {errors.phone && (
                <p className="text-error text-xs mt-1 font-medium">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="form-control">
              <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0 mb-1">
                I am joining as
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 cursor-pointer transition-all ${
                    selectedRole === "worker"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-base-200 bg-base-100 hover:border-base-300"
                  }`}
                >
                  <input
                    type="radio"
                    value="worker"
                    {...register("role")}
                    className="hidden"
                  />
                  <HardHat
                    className={`w-5 h-5 ${selectedRole === "worker" ? "text-primary" : "text-base-content/40"}`}
                  />
                  <span className="text-[11px] font-bold text-center text-base-content">
                    Looking for Work
                  </span>
                </label>

                <label
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 cursor-pointer transition-all ${
                    selectedRole === "employer"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-base-200 bg-base-100 hover:border-base-300"
                  }`}
                >
                  <input
                    type="radio"
                    value="employer"
                    {...register("role")}
                    className="hidden"
                  />
                  <Briefcase
                    className={`w-5 h-5 ${selectedRole === "employer" ? "text-primary" : "text-base-content/40"}`}
                  />
                  <span className="text-[11px] font-bold text-center text-base-content">
                    Hiring Workers
                  </span>
                </label>
              </div>
            </div>
          </>
        )}

        <div className="form-control">
          <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0 mb-1">
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute left-3 w-4 h-4 text-base-content/40" />
            <input
              {...register("email")}
              placeholder="name@example.com"
              type="email"
              autoComplete="email"
              className="input input-bordered input-sm sm:input-md w-full pl-10 focus:outline-primary/50 focus:border-primary bg-base-100"
            />
          </div>
          {errors.email && (
            <p className="text-error text-xs mt-1 font-medium">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="form-control">
          <label className="label text-[11px] font-bold text-base-content/60 uppercase tracking-wider py-0 mb-1">
            Password
          </label>
          <div className="relative flex items-center">
            <Lock className="absolute left-3 w-4 h-4 text-base-content/40" />
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="input input-bordered input-sm sm:input-md w-full pl-10 pr-10 focus:outline-primary/50 focus:border-primary bg-base-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 text-base-content/40 hover:text-base-content transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-error text-xs mt-1 font-medium">
              {errors.password.message}
            </p>
          )}
          {mode === "login" && (
            <div className="text-right mt-1.5">
              <Link
                to="/forgot-password"
                onClick={() => dispatch(closeAuthModal())}
                className="text-xs font-bold text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium">
            {error}
          </div>
        )}
        {mode === "login" &&
          errorCode === "EMAIL_NOT_VERIFIED" &&
          errorEmail && <ResendVerification email={errorEmail} />}

        <button
          type="submit"
          className="btn btn-primary btn-sm sm:btn-md w-full rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all mt-1"
          disabled={status === "loading"}
        >
          {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === "loading"
            ? "Please wait..."
            : mode === "login"
              ? "Log in"
              : "Create Account"}
        </button>
      </form>

      <div className="mt-4 pt-3 border-t border-base-200 flex items-center justify-center gap-1.5 text-xs sm:text-sm">
        <span className="text-base-content/60">
          {mode === "login" ? "New to Shyftra?" : "Already have an account?"}
        </span>
        <button
          type="button"
          className="font-bold text-primary hover:underline cursor-pointer"
          onClick={() =>
            dispatch(switchAuthMode(mode === "login" ? "signup" : "login"))
          }
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </div>
    </div>
  );
}

function AuthModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isOpen, mode, pendingAction } = useSelector(
    (state) => state.authModal,
  );
  const { status, user, pendingVerificationEmail } = useSelector(
    (state) => state.auth,
  );

  // Closing the modal also forgets the "check your email" state.
  function close() {
    dispatch(closeAuthModal());
    dispatch(clearPendingVerification());
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape" && status !== "loading") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, status, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAuthSuccess(freshUser, action) {
    if (!action) {
      dispatch(closeAuthModal());
      navigate("/dashboard");
      return;
    }
    // Re-run gates with the now-authenticated user.
    // runProtectedAction will either reopen the modal (verify/topup)
    // or execute the action and close the modal.
    runProtectedAction(action.type, action.data);
    dispatch(clearPendingAction());
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle z-100"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => status !== "loading" && close()}
          />
          <motion.div
            className="modal-box sm:max-w-md bg-base-100 p-5 sm:p-7 rounded-t-3xl sm:rounded-3xl shadow-xl border border-base-200 relative overflow-y-auto max-h-full"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Close Button */}
            <button
              onClick={() => status !== "loading" && close()}
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
            >
              ✕
            </button>

            {mode === "signup" && pendingVerificationEmail && (
              <CheckEmailPanel
                email={pendingVerificationEmail}
                onBackToLogin={() => {
                  dispatch(clearPendingVerification());
                  dispatch(switchAuthMode("login"));
                }}
              />
            )}
            {(mode === "login" || mode === "signup") &&
              !(mode === "signup" && pendingVerificationEmail) && (
                <AuthForm
                  key={mode}
                  mode={mode}
                  pendingAction={pendingAction}
                  onSuccess={handleAuthSuccess}
                />
              )}
            {mode === "verify_prompt" && (
              <VerifyPrompt onClose={() => dispatch(closeAuthModal())} />
            )}
            {mode === "topup_prompt" && (
              <TopupPromptContent
                requiredAmount={PLATFORM_FEE_FLAT}
                currentBalance={user?.walletBalance ?? 0}
                context="post_shift"
                onClose={() => dispatch(closeAuthModal())}
              />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- "Check your email" screen shown after signup (Task 2) ---
function CheckEmailPanel({ email, onBackToLogin }) {
  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 bg-success/10 text-success rounded-2xl flex items-center justify-center mx-auto mb-4">
        <MailCheck className="w-6 h-6" />
      </div>
      <h3 className="font-extrabold text-xl mb-2">Check your email</h3>
      <p className="text-sm text-base-content/70 leading-relaxed mb-5">
        We sent a verification link to{" "}
        <strong className="text-base-content">{email}</strong>. Click it to
        activate your account — you can't log in until you do. The link works
        for 24 hours.
      </p>
      <div className="space-y-3">
        <ResendVerification email={email} startCooldown />
        <button
          className="btn btn-ghost btn-sm w-full rounded-xl"
          onClick={onBackToLogin}
        >
          I've verified — go to login
        </button>
      </div>
    </div>
  );
}

// --- Verify Prompt ---
function VerifyPrompt({ onClose }) {
  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 bg-warning/10 text-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="font-extrabold text-xl mb-2">Verify your account first</h3>
      <p className="text-sm text-base-content/70 leading-relaxed mb-6">
        You need to verify your identity before you can post shifts or apply. It
        usually takes 1-2 minutes.
      </p>

      <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-xs text-base-content/80 text-left mb-6 leading-relaxed">
        ⚠️ <strong>Please note:</strong> Verification requires uploading an ID
        document in your profile settings. Once submitted, come back and try
        again.
      </div>

      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1 rounded-xl" onClick={onClose}>
          Cancel
        </button>
        <Link
          to="/profile"
          className="btn btn-primary flex-1 rounded-xl shadow-sm shadow-primary/20 gap-1.5"
          onClick={onClose}
        >
          Go to Profile <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default AuthModal;
