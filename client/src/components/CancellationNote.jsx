// client/src/components/CancellationNote.jsx
import { CheckCircle2, AlertTriangle, Info, FileText } from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function describe(app) {
  const received = app.penaltyToWorker > 0 ? inr(app.penaltyToWorker) : null;
  switch (app.status) {
    case "withdrawn":
      return { tone: "neutral", text: "You withdrew this application. No strike.", icon: Info };
    case "cancelled_by_worker":
      if (app.noShow) {
        return { tone: "bad", text: "The employer marked you as a no-show. A strike was added to your account.", icon: AlertTriangle };
      }
      if (app.strikeApplied === true) return { tone: "bad", text: "You cancelled this shift. A strike was added to your account.", icon: AlertTriangle };
      if (app.strikeApplied === false){

         if (app.cancellationReason === "Worker account was banned") {
            return { tone: "bad", text: "Your account was suspended, so this shift was cancelled.", icon: AlertTriangle };
        }
         return { tone: "good", text: "You cancelled with enough notice — no strike.", icon: CheckCircle2 };
      }
      return { tone: "neutral", text: "You cancelled this shift.", icon: Info };
    case "cancelled_by_employer":
      return received
        ? { tone: "good", text: `The employer cancelled late — you received ${received} as compensation. No strike.`, icon: CheckCircle2 }
        : { tone: "neutral", text: "The employer cancelled your acceptance. No strike for you.", icon: Info };
    case "cancelled_by_admin":
      return { tone: "neutral", text: "An administrator cancelled this shift. No strike for you.", icon: Info };
    case "expired":
      return received
        ? { tone: "good", text: `This shift never started — you received ${received} as compensation.`, icon: CheckCircle2 }
        : { tone: "neutral", text: "This shift expired without being worked.", icon: Info };
    default:
      return null;
  }
}

const TONE_CONFIG = {
  good: {
    container: "border-success/20 bg-success/10 text-success-content",
    iconColor: "text-success",
  },
  bad: {
    container: "border-error/20 bg-error/10 text-error-content",
    iconColor: "text-error",
  },
  neutral: {
    container: "border-base-200 bg-base-200/50 text-base-content/80",
    iconColor: "text-base-content/60",
  },
};

function CancellationNote({ app }) {
  const info = describe(app);
  if (!info) return null;
  
  const config = TONE_CONFIG[info.tone] || TONE_CONFIG.neutral;
  const Icon = info.icon;

  return (
    <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 shadow-sm ${config.container}`}>
      {Icon && <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />}
      <div className="flex-1 space-y-1">
        <p className="font-medium leading-relaxed">{info.text}</p>
        {app.cancellationReason && (
          <p className="text-xs opacity-75 flex items-center gap-1 font-medium pt-0.5">
            <FileText className="w-3 h-3" /> Reason: {app.cancellationReason}
          </p>
        )}
      </div>
    </div>
  );
}

export default CancellationNote;