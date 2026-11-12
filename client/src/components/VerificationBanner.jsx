// client/src/components/VerificationBanner.jsx
// The backend blocks apply / post-shift / browse-workers / payouts with a
// 403 until verificationStatus === "verified". This tells the user why,
// before they hit the wall.
import { Link } from "react-router";
import { useSelector } from "react-redux";
import { ShieldCheck, Clock, ShieldX, ArrowRight } from "lucide-react";

const COPY = {
  unverified: {
    icon: ShieldCheck,
    containerCls: "bg-warning/10 border-warning/20",
    iconCls: "text-warning",
    textCls: "text-warning-content/90",
    btnCls: "btn-warning text-warning-content",
    title: "Account Unverified",
    text: "You can browse shifts freely. To post or apply or browse workers, verify your account by uploading an ID document.",
    cta: "Verify Now",
  },
  pending: {
    icon: Clock,
    containerCls: "bg-info/10 border-info/20",
    iconCls: "text-info",
    textCls: "text-info-content/90",
    btnCls: "btn-info text-info-content",
    title: "Verification Pending",
    text: "Your documents are under review. Posting, applying, and withdrawals will unlock once an admin approves.",
    cta: "View Status",
  },
  rejected: {
    icon: ShieldX,
    containerCls: "bg-error/10 border-error/20",
    iconCls: "text-error",
    textCls: "text-error-content/90",
    btnCls: "btn-error text-error-content",
    title: "Verification Rejected",
    text: "Your previous verification attempt was rejected. Please upload a clearer document and try again.",
    cta: "Re-upload ID",
  },
};

export default function VerificationBanner({ className = "" }) {
  const { user } = useSelector((state) => state.auth);

  // Nothing to show for guests, admins (no verification flow), or
  // already-verified users.
  if (
    !user ||
    user.role === "admin" ||
    user.verificationStatus === "verified"
  ) {
    return null;
  }

  const copy = COPY[user.verificationStatus] || COPY.unverified;
  const Icon = copy.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${copy.containerCls} ${className}`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-base-100/50 shadow-sm ${copy.iconCls}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-0.5 mt-0.5">
          <h4 className={`font-extrabold text-sm uppercase tracking-wide ${copy.iconCls}`}>
            {copy.title}
          </h4>
          <p className={`text-sm font-medium leading-relaxed ${copy.textCls}`}>
            {copy.text}
          </p>
        </div>
      </div>
      
      <div className="shrink-0 w-full sm:w-auto flex justify-end">
        <Link 
          to="/profile" 
          className={`btn btn-sm sm:btn-md rounded-xl font-bold shadow-sm gap-1.5 w-full sm:w-auto border-none ${copy.btnCls}`}
        >
          {copy.cta} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}