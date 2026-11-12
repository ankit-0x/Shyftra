// client/src/components/ExitOtpPanel.jsx
// Worker-side exit-code display. On mount, asks the backend whether a
// still-valid code exists in Redis for this shift. A refresh keeps the
// same code visible without ever touching sessionStorage/localStorage.
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateExitOtp, fetchActiveExitOtp } from "../store/attendanceSlice";
import OtpDisplay from "./OtpDisplay";
import { RefreshCw, LogOut, AlertTriangle, Loader2 } from "lucide-react";

export default function ExitOtpPanel({ shiftId }) {
  const dispatch = useDispatch();

  const code = useSelector(
    (s) => s.attendance.exitOtpByShiftId?.[shiftId] ?? null,
  );
  const expiresAt = useSelector(
    (s) => s.attendance.exitOtpExpiresAtByShiftId?.[shiftId] ?? null,
  );

  // Derive loading from "which shiftId has the request finished for?"
  // No synchronous setState in an effect.
  const [loadedKey, setLoadedKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const loading = loadedKey !== shiftId;

  // Fetch any active exit code from backend on mount (and when shiftId changes).
  useEffect(() => {
    let cancelled = false;
    dispatch(fetchActiveExitOtp(shiftId)).finally(() => {
      if (!cancelled) setLoadedKey(shiftId);
    });
    return () => {
      cancelled = true;
    };
  }, [shiftId, dispatch]);

  // Re-fetch when the current code's TTL runs out — the backend returns
  // null, the reducer clears state, and we drop back to the button.
  useEffect(() => {
    if (!expiresAt) return undefined;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => {
      dispatch(fetchActiveExitOtp(shiftId));
    }, remaining + 1000);
    return () => clearTimeout(timer);
  }, [expiresAt, shiftId, dispatch]);

  async function handleGenerate() {
    setGenerating(true);
    const result = await dispatch(generateExitOtp(shiftId));
    setGenerating(false);
    if (generateExitOtp.fulfilled.match(result)) {
      setConfirmReplace(false);
    }
  }

  function onGenerateClick() {
    if (code) setConfirmReplace(true);
    else handleGenerate();
  }

  if (loading && !code) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!code) {
    return (
      <button
        type="button"
        className="btn btn-warning w-full sm:w-auto rounded-xl shadow-sm shadow-warning/20 font-bold gap-2 hover:-translate-y-0.5 transition-transform"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          <LogOut className="w-4 h-4 shrink-0" />
        )}
        {generating ? "Generating..." : "I'm Done — Generate Exit Code"}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <OtpDisplay
        code={code}
        label="Show this to your employer"
        expiresAt={expiresAt}
      />
      
      {confirmReplace ? (
        <div className="flex items-center gap-2 bg-error/10 border border-error/20 p-2 rounded-xl mt-1 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-error shrink-0 ml-1" />
          <span className="text-xs font-semibold text-error mr-1">Replace code?</span>
          <button
            type="button"
            className="btn btn-xs btn-error shadow-sm rounded-lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost rounded-lg"
            onClick={() => setConfirmReplace(false)}
            disabled={generating}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-xs sm:btn-sm btn-ghost btn-outline border-base-300 rounded-xl gap-1.5 mt-1"
          onClick={onGenerateClick}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Generate New Code
        </button>
      )}
    </div>
  );
}