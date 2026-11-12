// client/src/components/WorkerDashboard.jsx
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { fetchMyApplications } from "../store/applicationsSlice";
import VerificationBanner from "./VerificationBanner";
import WalletCard from "./WalletCard";
import ContactCard from "./ContactCard";
import PayoutMethodForm from "../components/PayoutMethodForm";
import WorkerCancelControl from "./WorkerCancelControl";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  ChevronRight,
  IndianRupee,
  History,
} from "lucide-react";

const STATUS_STYLES = {
  pending: "badge-warning",
  accepted: "badge-success",
  rejected: "badge-error",
  in_progress: "badge-info",
  pending_resolution: "badge-warning",
  disputed: "badge-error",
  completed: "badge-success",
  cancelled_by_worker: "badge-error",
  cancelled_by_employer: "badge-ghost",
};

function WorkerDashboard() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { list } = useSelector((state) => state.applications);

  useEffect(() => {
    if (user?.role === "worker") dispatch(fetchMyApplications());
  }, [dispatch, user?.role]);

  // Fallback for non-worker roles
  if (user?.role !== "worker") {
    return (
      <div className="min-h-screen bg-base-200/50 p-4 md:p-6 flex items-center justify-center">
        <div className="bg-base-100 rounded-3xl border border-base-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-base-200/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-base-content/40" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Welcome, {user?.name}
          </h1>
          <p className="text-sm text-base-content/60 mt-2 leading-relaxed">
            You're signed in as a{" "}
            <span className="capitalize font-bold text-primary">
              {user?.role}
            </span>
            . A full dashboard is coming in a future update.
          </p>
        </div>
      </div>
    );
  }

  const recentApplications = list.slice(0, 5);

  return (
    <div className="min-h-screen bg-base-200/50 p-3 sm:p-5 lg:p-6 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-base-100 rounded-2xl p-4 sm:p-6 border border-base-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-base-content tracking-tight">
                Welcome back, {user.name}
              </h1>
              <p className="text-xs sm:text-sm text-base-content/60">
                Worker Dashboard
              </p>
            </div>
          </div>
        </div>

        <VerificationBanner />

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* LEFT SIDEBAR: Profile, Wallet, Payout Settings */}
          <div className="grid grid-rows-3 lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Profile Card */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-5">
              <h2 className="font-extrabold text-base flex items-center gap-2 mb-3 pb-2 border-b border-base-200 tracking-tight">
                <User className="w-4 h-4 text-primary" /> Profile Details
              </h2>
              <div className="space-y-3 mt-1">
                <div className="flex items-center gap-3 text-sm text-base-content/80 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-base-200/60 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-base-content/60" />
                  </div>
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-base-content/80 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-base-200/60 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-base-content/60" />
                  </div>
                  <span>{user.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-base-content/80 font-medium capitalize">
                  <div className="w-8 h-8 rounded-lg bg-base-200/60 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-base-content/60" />
                  </div>
                  <span>{user.role}</span>
                </div>
              </div>
            </div>

            <WalletCard />
            <PayoutMethodForm />
          </div>

          {/* RIGHT MAIN CONTENT: Recent Applications */}
          <div className="lg:col-span-2">
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-5 h-full">
              {/* Section Header */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-base-200">
                <h2 className="font-extrabold text-lg flex items-center gap-2 tracking-tight">
                  <History className="w-5 h-5 text-primary" /> Recent
                  Applications
                </h2>
                <Link
                  to="/applications"
                  className="btn btn-ghost btn-sm text-primary group hover:bg-primary/10 rounded-xl px-2"
                >
                  <span className="hidden sm:inline font-bold">View all</span>
                  <ChevronRight className="w-4 h-4 sm:group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Applications List */}
              {recentApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-base-200/50 rounded-2xl flex items-center justify-center mb-4 border border-base-200">
                    <Briefcase className="w-8 h-8 text-base-content/20" />
                  </div>
                  <p className="text-sm font-medium text-base-content/60">
                    You haven't applied to any shifts yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {recentApplications.map((app) => (
                    <div
                      key={app._id}
                      className="bg-base-100 sm:bg-base-200/40 rounded-2xl p-4 border border-base-200 hover:border-primary/30 transition-colors shadow-sm sm:shadow-none"
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3.5">
                        {/* Shift Info */}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/shifts/${app.shift?._id}`}
                            className="font-extrabold text-base sm:text-lg text-base-content hover:text-primary transition-colors line-clamp-2 leading-snug"
                          >
                            {app.shift?.title || "Untitled Shift"}
                          </Link>

                          {app.status === "accepted" &&
                            app.escrowAmount > 0 && (
                              <div className="mt-2.5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent font-bold text-[11px] gap-1">
                                  <IndianRupee className="w-3 h-3" />{" "}
                                  {app.escrowAmount} secured in escrow
                                </span>
                              </div>
                            )}
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center sm:flex-col sm:items-end gap-2.5 shrink-0 justify-between sm:justify-start w-full sm:w-auto mt-1 sm:mt-0">
                          <span
                            className={`badge font-bold uppercase tracking-wide text-[10px] px-2.5 py-1 ${STATUS_STYLES[app.status] || "badge-ghost"}`}
                          >
                            {app.status === "cancelled_by_worker" && app.noShow
                              ? "no show"
                              : app.status.replaceAll("_", " ")}
                          </span>

                          {/* Replaces the old custom Cancel button + ConfirmActionModal.
                              WorkerCancelControl handles both:
                                - pending → "Withdraw" (no strike)
                                - accepted + scheduled → "Cancel Shift" (reason + strike preview) */}
                          <WorkerCancelControl app={app} />
                        </div>
                      </div>

                      {/* Employer Contact Data */}
                      {[
                        "accepted",
                        "in_progress",
                        "pending_resolution",
                        "disputed",
                      ].includes(app.status) && (
                        <div className="mt-4 pt-4 border-t border-base-200/60">
                          <ContactCard
                            title="Employer Contact"
                            name={app.shift?.employer?.user?.name}
                            phone={app.shift?.employer?.user?.phone}
                            role="employer"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkerDashboard;