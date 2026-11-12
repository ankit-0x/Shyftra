// client/src/pages/ShiftDetail.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Helmet } from "react-helmet-async";
import api from "../api/axios";
import { runProtectedAction } from "../utils/runProtectedAction";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyApplications } from "../store/applicationsSlice";
import WorkerCancelControl from "../components/WorkerCancelControl";
import {
  STATUS_STYLES,
  STATUS_MESSAGES,
  WORKING_STATUSES,
  statusLabel,
} from "../utils/applicationStatus";
import ShiftReviews from "../components/ShiftReviews";
import { formatDateTime } from "../utils/format";
import { useLiveTick } from "../hooks/useLiveTick";
import {
  CalendarClock,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowLeft,
  Share2,
  Check,
  MapPin,
  Building2,
  Star,
  IndianRupee,
  Users,
  ChevronRight,
  Loader2,
  Lock,
  Briefcase,
  Info,
  AlertTriangle,
} from "lucide-react";

function ShiftDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const [shift, setShift] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const { user } = useSelector((state) => state.auth);
  const rawApplicationState = useSelector(
    (state) => state.applications.byShiftId?.[id],
  );
  const applicationRow = useSelector((state) =>
    state.applications.list.find((a) => a.shift?._id === id),
  );

  const applicationState =
    rawApplicationState?.status === "withdrawn"
      ? undefined
      : rawApplicationState;

  const liveTick = useLiveTick("shifts:changed", id);

  useEffect(() => {
    api
      .get(`/api/shifts/${id}`)
      .then((res) => setShift(res.data))
      .catch(() => {
        if (liveTick === 0) setError("Shift not found");
      });
  }, [id, liveTick]);

  useEffect(() => {
    if (user) dispatch(fetchMyApplications());
  }, [user, dispatch]);

  function handleApplyClick() {
    runProtectedAction("apply", id);
  }

  function handleShareClick() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: shift.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-base-200/50">
        <ShieldAlert className="w-12 h-12 text-error mb-3 opacity-80" />
        <p className="text-xl font-bold text-error">{error}</p>
        <Link to="/worker" className="btn btn-outline mt-4">
          Go back to shifts
        </Link>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-base-200/50 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-base-content/60 font-medium">
          Loading shift details...
        </p>
      </div>
    );
  }

  /* ── role derivation ── */
  const isAdmin = user?.role === "admin";
  const isWorker = !user || user.role === "worker";
  const employerUserId = shift.employer?.user?._id || shift.employer?.user;
  const isOwnShift =
    user?.role === "employer" &&
    employerUserId &&
    String(employerUserId) === String(user.id);

  /* ── back link per role ── */
  const backLink = isAdmin
    ? { to: "/admin", label: "Back to Admin Console" }
    : user?.role === "employer"
      ? { to: "/my-shifts", label: "Back to My Shifts" }
      : { to: "/worker", label: "Back to all shifts" };

  const isApplying = applicationState?.status === "applying";
  const hours = (new Date(shift.endTime) - new Date(shift.startTime)) / 3600000;
  const spotsLeft = Math.max(
    0,
    (shift.workersNeeded ?? 1) - (shift.acceptedCount ?? 0),
  );

  const skillsList = Array.isArray(shift.skillRequired)
    ? shift.skillRequired
    : shift.skillRequired
      ? [shift.skillRequired]
      : [];

  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <Helmet>
        <title>{shift.title} — Shyftra</title>
        <meta
          name="description"
          content={`${shift.title} at ${shift.employer?.businessName}. ₹${(shift.hourlyPay / 100).toFixed(0)}/hr, ${shift.address}.`}
        />
        <meta property="og:title" content={shift.title} />
        <meta
          property="og:description"
          content={`₹${(shift.hourlyPay / 100).toFixed(0)}/hr near ${shift.address}`}
        />
        <meta property="og:url" content={window.location.href} />
      </Helmet>

      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <Link
          to={backLink.to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/60 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {backLink.label}
        </Link>

        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
          <div className="p-6 sm:p-8 pb-0">
            <div className="flex justify-between items-start gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-base-content leading-tight">
                {shift.title}
              </h1>
              <button
                onClick={handleShareClick}
                className={`btn btn-sm shrink-0 rounded-full gap-2 transition-colors ${
                  copied
                    ? "bg-success/10 text-success hover:bg-success/20 border-success/20"
                    : "btn-outline border-base-300"
                }`}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {copied ? "Copied" : "Share"}
                </span>
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-base-content/80 font-medium">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  {shift.employer?.businessName}
                </span>
                {shift.employer?.rating != null && (
                  <span className="flex items-center gap-1 text-sm bg-base-200 px-2 py-0.5 rounded-md">
                    <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    {shift.employer.rating}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-1.5 text-base-content/70 text-sm sm:text-base">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{shift.address}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="badge badge-primary px-3 py-3 gap-1 font-bold text-sm">
                <IndianRupee className="w-3.5 h-3.5" />{" "}
                {(shift.hourlyPay / 100).toFixed(0)}/hr
              </span>
              {skillsList.map((skill, index) => (
                <span
                  key={index}
                  className="badge badge-outline border-base-300 px-3 py-3 gap-1.5 font-medium text-sm"
                >
                  <Wrench className="w-3.5 h-3.5 text-base-content/60" />{" "}
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-6 sm:mx-8 mt-6 bg-base-200/50 rounded-2xl p-5 border border-base-200">
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-base-100 rounded-lg shadow-sm border border-base-200 shrink-0">
                  <CalendarClock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <dt className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-0.5">
                    Date & Time
                  </dt>
                  <dd className="font-medium text-base-content/90">
                    {formatDateTime(shift.startTime)}{" "}
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> – </span>
                    {formatDateTime(shift.endTime)}
                  </dd>
                </div>
              </div>

              {hours > 0 && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-base-100 rounded-lg shadow-sm border border-base-200 shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-0.5">
                      Duration & Total
                    </dt>
                    <dd className="font-medium text-base-content/90">
                      {+hours.toFixed(2)} hr{hours === 1 ? "" : "s"} total
                      <div className="text-success font-bold mt-0.5 flex items-center gap-0.5">
                        ≈ <IndianRupee className="w-3.5 h-3.5" />{" "}
                        {+((hours * shift.hourlyPay) / 100).toFixed(2)} estimated
                      </div>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="px-6 sm:px-8 mt-6">
            <p className="flex items-center gap-2 text-sm font-medium text-base-content/70 bg-base-200/30 w-fit px-3 py-1.5 rounded-lg border border-base-200">
              <Users className="w-4 h-4 opacity-70" />
              {spotsLeft > 0
                ? `${spotsLeft} of ${shift.workersNeeded} position${shift.workersNeeded > 1 ? "s" : ""} open`
                : "All positions filled"}
            </p>

            {shift.description && (
              <div className="mt-6 text-base-content/80 leading-relaxed whitespace-pre-line wrap-break-word">
                <h3 className="font-bold text-base-content mb-2">
                  About this shift
                </h3>
                {shift.description}
              </div>
            )}
          </div>

          {/* ─── role-aware action area ─── */}
          <div className="p-6 sm:p-8 mt-6 bg-base-200/30 border-t border-base-200">
            {/* ADMIN */}
            {isAdmin && (
              <div className="space-y-3">
                <div className="rounded-xl border border-info/20 bg-info/10 p-4 text-sm flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <p className="text-base-content/80 leading-relaxed">
                    You're viewing this shift as an administrator. Use the
                    Admin Console to manage the employer, cancel this shift,
                    or intervene in any disputes.
                  </p>
                </div>
                <Link
                  to="/admin"
                  className="btn btn-primary w-full rounded-xl text-lg font-bold shadow-md shadow-primary/20 gap-2"
                >
                  Open Admin Console
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            )}

            {/* EMPLOYER — owns this shift */}
            {isOwnShift && (
              <div className="space-y-3">
                <div className="rounded-xl border border-info/20 bg-info/10 p-4 text-sm flex gap-3">
                  <Briefcase className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <p className="text-base-content/80 leading-relaxed">
                    This shift belongs to you. Manage applicants, verify
                    attendance, and settle payments from My Shifts.
                  </p>
                </div>
                <Link
                  to={`/my-shifts?shift=${shift._id}`}
                  className="btn btn-primary w-full rounded-xl text-lg font-bold shadow-md shadow-primary/20 gap-2"
                >
                  Manage this shift
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            )}

            {/* EMPLOYER — does not own */}
            {user?.role === "employer" && !isOwnShift && (
              <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm flex gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-base-content/80 leading-relaxed">
                  This shift is posted by another employer. You can only view
                  its details.
                </p>
              </div>
            )}

            {/* WORKER / GUEST — apply + status flow (existing behavior) */}
            {isWorker && (
              <>
                {isApplying ? (
                  <button
                    className="btn btn-disabled w-full rounded-xl gap-2 font-bold"
                    disabled
                  >
                    <Loader2 className="w-5 h-5 animate-spin" /> Applying...
                  </button>
                ) : applicationState ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`badge font-medium px-3 py-3 ${STATUS_STYLES[applicationState.status] || "badge-ghost"}`}
                      >
                        {statusLabel(applicationState)}
                      </span>
                      {applicationState.status === "accepted" &&
                        applicationState.escrowAmount > 0 && (
                          <span className="badge badge-accent font-bold px-3 py-3 gap-1">
                            <IndianRupee className="w-3.5 h-3.5" />{" "}
                            {applicationState.escrowAmount} secured
                          </span>
                        )}
                    </div>

                    <p className="text-sm font-medium text-base-content/70">
                      {STATUS_MESSAGES[applicationState.status]}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <WorkerCancelControl
                        className="btn btn-sm btn-outline btn-error rounded-lg"
                        app={
                          applicationRow ?? {
                            _id: applicationState.id,
                            status: applicationState.status,
                            shift: { _id: id, title: shift.title },
                          }
                        }
                      />
                      {WORKING_STATUSES.includes(applicationState.status) && (
                        <Link
                          to="/applications"
                          className="btn btn-sm btn-primary btn-outline rounded-lg gap-1"
                        >
                          Manage shift <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                ) : shift.status !== "open" ? (
                  <button className="btn btn-disabled w-full rounded-xl" disabled>
                    This shift is no longer available
                  </button>
                ) : user && user.verificationStatus !== "verified" ? (
                  <div className="rounded-2xl border-2 border-dashed border-warning/40 bg-warning/5 p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center text-warning mb-1">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <h3 className="text-xl font-extrabold text-base-content tracking-tight">
                        Verification Required
                      </h3>
                      <p className="text-sm text-base-content/70 leading-relaxed">
                        To ensure safety and trust in our community, you must
                        verify your identity before applying to shifts. It only
                        takes a minute.
                      </p>
                    </div>
                    <Link
                      to="/profile"
                      className="btn btn-warning text-warning-content w-full sm:w-auto px-8 rounded-xl shadow-md shadow-warning/20 font-bold gap-2 mt-2 hover:-translate-y-0.5 transition-transform"
                    >
                      Verify Identity <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={handleApplyClick}
                    className="btn btn-primary w-full rounded-xl text-lg font-bold shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-transform"
                  >
                    Apply for this shift
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-6 sm:p-8">
          <ShiftReviews shiftId={id} />
        </div>
      </div>
    </div>
  );
}

export default ShiftDetail;