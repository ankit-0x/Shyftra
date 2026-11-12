// client/src/components/EmployerDashboard.jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { useLiveTick } from "../hooks/useLiveTick";
import { fetchEmployerStats } from "../store/employerShiftsSlice";
import { fetchWalletSummary } from "../store/walletSlice";
import WalletCard from "./WalletCard";
import VerificationBanner from "./VerificationBanner";
import WalletTopUp from "./WalletTopUp";
import PayoutMethodForm from "./PayoutMethodForm";
import {
  Briefcase,
  Users,
  IndianRupee,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  AlertTriangle,
  Building2,
  Clock,
  ExternalLink, // ✅ NEW
} from "lucide-react";

function StatCard({ label, value, icon: Icon, tone, loading }) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="bg-base-100 rounded-xl border border-base-200 p-3 shadow-sm">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${toneClasses[tone]}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-black text-base-content">
        {loading ? "…" : value}
      </p>
      <p className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function EmployerDashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const stats = useSelector((state) => state.employerShifts.stats);

  const liveTick = useLiveTick("shifts:changed");

  useEffect(() => {
    dispatch(fetchEmployerStats());
    dispatch(fetchWalletSummary());
  }, [dispatch, liveTick]);

  const hasPendingActions =
    (stats?.pendingApplications ?? 0) > 0 ||
    (stats?.disputesNeedingProof ?? 0) > 0;

  return (
    <div className="min-h-screen bg-base-200/50 p-3 sm:p-5 lg:p-6 animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header + Wallet */}
        <div className="bg-base-100 rounded-2xl p-4 sm:p-6 border border-base-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-base-content tracking-tight">
                Welcome, {user?.name || "Employer"}
              </h1>
              <p className="text-xs sm:text-sm text-base-content/60">
                Employer Overview
              </p>
            </div>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <WalletCard />
          </div>
        </div>

        <VerificationBanner />

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Active"
            value={stats?.activeShifts ?? 0}
            icon={Briefcase}
            tone="primary"
            loading={!stats}
          />
          <StatCard
            label="Pending Apps"
            value={stats?.pendingApplications ?? 0}
            icon={Users}
            tone="warning"
            loading={!stats}
          />
          <StatCard
            label="On Site"
            value={stats?.onSite ?? 0}
            icon={CheckCircle2}
            tone="info"
            loading={!stats}
          />
          <StatCard
            label="Spent (MTD)"
            value={`₹${Math.round(stats?.thisMonthSpend ?? 0)}`}
            icon={IndianRupee}
            tone="success"
            loading={!stats}
          />
        </div>

        {/* Pending actions banner */}
        {hasPendingActions && (
          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="font-bold text-sm text-warning uppercase tracking-wider">
                Needs your attention
              </h3>
            </div>

            {(stats?.pendingApplications ?? 0) > 0 && (
              <Link
                to="/my-shifts"
                className="flex items-center justify-between p-2.5 rounded-lg bg-base-100/50 hover:bg-base-100 transition-colors"
              >
                <span className="text-sm font-medium text-base-content">
                  {stats.pendingApplications} application
                  {stats.pendingApplications === 1 ? "" : "s"} waiting for
                  review
                </span>
                <ArrowRight className="w-4 h-4 text-warning" />
              </Link>
            )}

            {(stats?.disputesNeedingProof ?? 0) > 0 && (
              <Link
                to="/my-shifts"
                className="flex items-center justify-between p-2.5 rounded-lg bg-base-100/50 hover:bg-base-100 transition-colors"
              >
                <span className="text-sm font-medium text-base-content">
                  {stats.disputesNeedingProof} dispute
                  {stats.disputesNeedingProof === 1 ? "" : "s"} need evidence
                  upload
                </span>
                <ArrowRight className="w-4 h-4 text-warning" />
              </Link>
            )}
          </div>
        )}

        {/* Upcoming shifts */}
        <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 sm:p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-extrabold text-base flex items-center gap-2 tracking-tight">
              <CalendarClock className="w-4 h-4 text-primary" /> Upcoming Shifts
            </h2>
            <Link
              to="/my-shifts"
              className="btn btn-ghost btn-sm text-primary rounded-xl gap-1 hover:bg-primary/10"
            >
              Manage all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {!stats ? (
            <div className="text-center py-6 text-base-content/40 text-sm">
              Loading…
            </div>
          ) : stats.upcomingShifts?.length === 0 ? (
            <div className="text-center py-6">
              <Briefcase className="w-10 h-10 text-base-content/20 mx-auto mb-2" />
              <p className="text-sm text-base-content/60">No upcoming shifts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.upcomingShifts.map((s) => (
                <Link
                  key={s._id}
                  // ✅ CHANGED: now opens role-aware ShiftDetail (employer
                  // sees "Manage this shift" button there). One extra click
                  // vs previous deep-link, but much clearer mental model —
                  // users see the shift's public view first, then manage.
                  to={`/shifts/${s._id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200/40 border border-base-200 hover:border-primary/30 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-base-content truncate flex items-center gap-1.5">
                      {s.title}
                      <ExternalLink className="w-3 h-3 text-base-content/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </p>
                    <p className="text-xs text-base-content/60 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(s.startTime).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {s.acceptedCount}/{s.workersNeeded} filled
                    </p>
                  </div>
                  <span
                    className={`badge badge-sm shrink-0 ${
                      s.status === "open" ? "badge-success" : "badge-info"
                    }`}
                  >
                    {s.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Post-a-shift CTA */}
        <Link
          to="/employer"
          className="block bg-linear-to-r from-primary/10 via-base-100 to-secondary/10 border border-base-200 rounded-2xl p-4 sm:p-5 hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-content flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-base-content">
                  Post your next shift
                </p>
                <p className="text-xs text-base-content/60">
                  Match with verified workers nearby in under a minute
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Wallet tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WalletTopUp />
          <PayoutMethodForm />
        </div>
      </div>
    </div>
  );
}

export default EmployerDashboard;
