// client/src/components/StrikeMeter.jsx
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { MAX_STRIKES } from "../constants/businessRule";

function StrikeMeter({ strikes = 0, max = MAX_STRIKES, className = "" }) {
  const safe = Math.min(Math.max(strikes, 0), max);

  // Dynamically determine the tone, messaging, and styles based on strike count
  let tone;
  if (safe === 0) {
    tone = { 
      text: "Clean record", 
      textCls: "text-success", 
      bgCls: "bg-success/10",
      barCls: "bg-success",
      Icon: ShieldCheck 
    };
  } else if (safe >= max) {
    tone = { 
      text: "Account suspended.", 
      textCls: "text-error", 
      bgCls: "bg-error/10",
      barCls: "bg-error shadow-sm shadow-error/30",
      Icon: ShieldAlert 
    };
  } else if (safe === max - 1) {
    tone = { 
      text: "Warning: one more strike suspends your account.", 
      textCls: "text-error", 
      bgCls: "bg-error/10",
      barCls: "bg-error",
      Icon: ShieldAlert 
    };
  } else {
    tone = { 
      text: `${safe} strike${safe > 1 ? 's' : ''} — late cancellations or no-shows.`, 
      textCls: "text-warning", 
      bgCls: "bg-warning/10",
      barCls: "bg-warning",
      Icon: ShieldAlert 
    };
  }

  const { Icon, text, textCls, bgCls, barCls } = tone;

  return (
    <div 
      className={`flex items-start sm:items-center gap-3.5 bg-base-100 border border-base-200 p-3.5 rounded-2xl shadow-sm ${className}`} 
      role="group" 
      aria-label={`${safe} of ${max} strikes`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgCls}`}>
        <Icon className={`w-5 h-5 ${textCls}`} aria-hidden="true" />
      </div>
      
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-8 rounded-full transition-all duration-300 ${
                i < safe ? barCls : "bg-base-200/80"
              }`}
            />
          ))}
        </div>
        <p className={`text-xs font-medium leading-tight mt-0.5 ${textCls}`}>
          <span className="font-extrabold">{safe}/{max}</span> <span className="opacity-60 px-0.5">•</span> {text}
        </p>
      </div>
    </div>
  );
}

export default StrikeMeter;