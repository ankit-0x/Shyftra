// client/src/pages/ResetPassword.jsx   route: /reset-password/:token
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDispatch } from "react-redux";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Helmet } from "react-helmet-async";
import { Loader2, CheckCircle2 } from "lucide-react";
import { resetPasswordWithToken, apiError } from "../api/authApi";
import { resetPasswordSchema } from "../schemas/password";
import { openAuthModal } from "../store/authModalSlice";
import { clearAuth } from "../store/authSlice";
import PasswordInput from "../components/PasswordInput";
import PasswordStrength from "../components/PasswordStrength";

function ResetPassword() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(null); // { message, code }
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });
  const password = useWatch({ control, name: "password" }) || "";

  async function onSubmit({ password }) {
    setServerError(null);
    try {
      await resetPasswordWithToken(token, password);
      dispatch(clearAuth()); // server revoked every session, including this browser's
      setDone(true);
    } catch (err) {
      setServerError(apiError(err));
    }
  }

  function goLogin() {
    navigate("/", { replace: true });
    dispatch(openAuthModal({ mode: "login" }));
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <Helmet>
        <title>Reset password · Shyftra</title>
      </Helmet>
      <div className="w-full max-w-md bg-base-100 rounded-3xl border border-base-200 shadow-sm p-8">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="font-extrabold text-2xl mb-2">Password updated</h1>
            <p className="text-sm text-base-content/70 mb-6">
              All devices were signed out. Log in with your new password.
            </p>
            <button
              className="btn btn-primary w-full rounded-xl"
              onClick={goLogin}
            >
              Log in
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-extrabold text-2xl mb-1">
              Choose a new password
            </h1>
            <p className="text-sm text-base-content/60 mb-5">
              Pick something you haven't used elsewhere.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-3"
              noValidate
            >
              <div>
                <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">
                  New password
                </label>
                <PasswordInput
                  {...register("password")}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={errors.password}
                />
                <PasswordStrength password={password} />
                {errors.password && (
                  <p className="text-error text-xs mt-1 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">
                  Confirm password
                </label>
                <PasswordInput
                  {...register("confirmPassword")}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={errors.confirmPassword}
                />
                {errors.confirmPassword && (
                  <p className="text-error text-xs mt-1 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
              {serverError && (
                <div className="text-error text-xs bg-error/10 border border-error/20 rounded-xl p-2.5 font-medium">
                  {serverError.message}
                  {serverError.code === "TOKEN_INVALID" && (
                    <>
                      {" "}
                      <Link
                        to="/forgot-password"
                        className="underline font-bold"
                      >
                        Request a new link
                      </Link>
                    </>
                  )}
                  {serverError.code === "SAME_PASSWORD" && (
                    <>
                      {" "}
                      Pick a password you haven't used before on this account.
                    </>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full rounded-xl"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}{" "}
                Reset password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
