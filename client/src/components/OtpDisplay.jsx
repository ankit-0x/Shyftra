// client/src/components/OtpDisplay.jsx
import { useEffect, useState } from "react";
import { Clock, AlertCircle } from "lucide-react";

const DEFAULT_LIFETIME_SECONDS = 15 * 60;

function Countdown({ code, label, expiresAt }) {
  const computeRemaining = () => {
    if (expiresAt) return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return DEFAULT_LIFETIME_SECONDS;
  };

  const [secondsLeft, setSecondsLeft] = useState(computeRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (expiresAt) {
          return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const expired = secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {label && (
        <p className="text-[11px] font-extrabold text-base-content/50 uppercase tracking-wider">
          {label}
        </p>
      )}
      
      <div className="flex gap-2 sm:gap-2.5">
        {code.split("").map((digit, i) => (
          <div
            key={i}
            className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center rounded-xl border-2 text-2xl font-mono font-black shadow-sm transition-all ${
              expired
                ? "border-base-300 bg-base-200/60 text-base-content/30 shadow-none"
                : "border-primary/30 bg-primary/5 text-primary shadow-primary/10"
            }`}
          >
            {digit}
          </div>
        ))}
      </div>
      
      <div className={`flex items-center gap-1.5 text-xs font-bold mt-0.5 ${expired ? "text-error" : "text-base-content/60"}`}>
        {expired ? (
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {expired
            ? "Expired — please generate a new code"
            : `Expires in ${minutes}:${seconds.toString().padStart(2, "0")}`}
        </span>
      </div>
    </div>
  );
}

function OtpDisplay({ code, label, expiresAt = null }) {
  // key={code} so a fresh code remounts the timer; the expiresAt prop keeps
  // the countdown accurate to the real Redis TTL after a refresh.
  return <Countdown key={code} code={code} label={label} expiresAt={expiresAt} />;
}

export default OtpDisplay;