// client/src/components/OtpPanel.jsx
// Employer-side check-in OTP. On mount, asks the backend whether a valid
// code already exists in Redis for this shift+worker pair. That lets a
// page refresh restore the display without ever writing the code to
// sessionStorage/localStorage (XSS surface).
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateOtp, fetchActiveOtp } from "../store/employerShiftsSlice";
import OtpDisplay from "./OtpDisplay";
import { RefreshCw, Key, AlertTriangle, Loader2 } from "lucide-react";

export default function OtpPanel({ shiftId, workerId }) {
  const dispatch = useDispatch();

  const code = useSelector(
    (s) => s.employerShifts.otpByWorkerId?.[workerId] ?? null,
  );
  const expiresAt = useSelector(
    (s) => s.employerShifts.otpExpiresAtByWorkerId?.[workerId] ?? null,
  );

  // Derive loading from "which (shiftId, workerId) has finished loading?"
  // No synchronous setState in an effect.
  const currentKey = `${shiftId}:${workerId}`;
  const [loadedKey, setLoadedKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const loading = loadedKey !== currentKey;

  // On mount (and whenever shiftId/workerId change) fetch from backend.
  useEffect(() => {
    let cancelled = false;
    const key = `${shiftId}:${workerId}`;
    dispatch(fetchActiveOtp({ shiftId, workerId })).finally(() => {
      if (!cancelled) setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [shiftId, workerId, dispatch]);

  // Auto-refresh when the code's TTL passes — backend will return null,
  // which the reducer uses to clear state and drop back to the button.
  useEffect(() => {
    if (!expiresAt) return undefined;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => {
      dispatch(fetchActiveOtp({ shiftId, workerId }));
    }, remaining + 1000);
    return () => clearTimeout(timer);
  }, [expiresAt, shiftId, workerId, dispatch]);

  async function handleGenerate() {
    setGenerating(true);
    const result = await dispatch(generateOtp({ shiftId, workerId }));
    setGenerating(false);
    if (generateOtp.fulfilled.match(result)) {
      setConfirmReplace(false);
    }
  }

  function onGenerateClick() {
    if (code) setConfirmReplace(true);
    else handleGenerate();
  }

  if (loading && !code) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!code) {
    return (
      <button
        type="button"
        className="btn btn-xs sm:btn-sm btn-outline border-base-300 rounded-xl gap-1.5 flex-1 sm:flex-none"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          <Key className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
        {generating ? "Generating..." : "Generate Check-in Code"}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-2.5 w-full sm:w-auto">
      <OtpDisplay code={code} label="Check-in code" expiresAt={expiresAt} />
      
      {confirmReplace ? (
        <div className="flex items-center gap-2 bg-error/10 border border-error/20 p-2 rounded-xl mt-1 animate-fade-in w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0" />
            <span className="text-[11px] font-semibold text-error uppercase tracking-wide">Replace code?</span>
          </div>
          <div className="flex items-center gap-1.5">
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
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-xs btn-ghost btn-outline border-base-300 rounded-xl gap-1.5 mt-1"
          onClick={onGenerateClick}
        >
          <RefreshCw className="w-3 h-3" /> Generate New Code
        </button>
      )}
    </div>
  );
}