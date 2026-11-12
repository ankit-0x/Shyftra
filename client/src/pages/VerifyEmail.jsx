// client/src/pages/VerifyEmail.jsx   route: /verify-email/:token
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDispatch } from "react-redux";
import { Helmet } from "react-helmet-async";
import { Loader2, CheckCircle2, XCircle, MailWarning } from "lucide-react";
import { verifyEmailToken, apiError } from "../api/authApi";
import { openAuthModal } from "../store/authModalSlice";

function VerifyEmail() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: "loading", message: "" }); // loading | ok | expired | invalid | error
  // React 18/19 StrictMode runs effects twice in dev; the token is single-use,
  // so guard against calling the API twice.
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    verifyEmailToken(token)
      .then((d) => setState({ phase: "ok", message: d.message }))
      .catch((err) => {
        const e = apiError(err, "Verification failed");
        if (e.code === "TOKEN_EXPIRED") setState({ phase: "expired", message: e.message });
        else if (e.code === "TOKEN_INVALID") setState({ phase: "invalid", message: e.message });
        else setState({ phase: "error", message: e.message });
      });
  }, [token]);

  function goLogin() {
    navigate("/", { replace: true });
    dispatch(openAuthModal({ mode: "login" }));
  }

  const { phase, message } = state;
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <Helmet><title>Verify email · Shyftra</title></Helmet>
      <div className="w-full max-w-md bg-base-100 rounded-3xl border border-base-200 shadow-sm p-8 text-center">
        {phase === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="font-semibold">Verifying your email…</p>
          </>
        )}
        {phase === "ok" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-success/10 text-success flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-7 h-7" /></div>
            <h1 className="font-extrabold text-2xl mb-2">Email verified</h1>
            <p className="text-sm text-base-content/70 mb-6">{message}</p>
            <button className="btn btn-primary w-full rounded-xl" onClick={goLogin}>Log in</button>
          </>
        )}
        {phase === "expired" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-warning/10 text-warning flex items-center justify-center mx-auto mb-4"><MailWarning className="w-7 h-7" /></div>
            <h1 className="font-extrabold text-2xl mb-2">Link expired</h1>
            <p className="text-sm text-base-content/70 mb-6">{message} Log in with your password and we will offer to send a fresh link.</p>
            <button className="btn btn-primary w-full rounded-xl" onClick={goLogin}>Go to login</button>
          </>
        )}
        {(phase === "invalid" || phase === "error") && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto mb-4"><XCircle className="w-7 h-7" /></div>
            <h1 className="font-extrabold text-2xl mb-2">Couldn't verify</h1>
            <p className="text-sm text-base-content/70 mb-6">{message}</p>
            <button className="btn btn-primary w-full rounded-xl" onClick={goLogin}>Go to login</button>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
