// client/src/pages/MyApplications.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { fetchMyApplications } from "../store/applicationsSlice";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { clockIn, raiseDispute } from "../store/attendanceSlice";
import OtpInput from "../components/OtpInput";
import ExitOtpPanel from "../components/ExitOtpPanel";
import DisputeReasonModal from "../components/DisputeReasonModal";
import { fetchDispute } from "../store/disputesSlice";
import { submitReview, fetchMyReviews } from "../store/reviewsSlice";
import RatingModal from "../components/RatingModal";
import ArrivalButton from "../components/ArrivalButton";
import VerificationBanner from "../components/VerificationBanner";
import ContactCard from "../components/ContactCard";
import WorkerCancelControl from "../components/WorkerCancelControl";
import CancellationNote from "../components/CancellationNote";
import StrikeMeter from "../components/StrikeMeter";
import { STATUS_STYLES, statusLabel } from "../utils/applicationStatus";
import {
  Loader2,
  Clock,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Building2,
  IndianRupee,
  Star,
  Info,
  Search,
  Briefcase,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";

function DisputedWorkerPanel({ disputeId }) {
  const dispatch = useDispatch();
  const dispute = useSelector((state) => state.disputes.byId[disputeId]);

  useEffect(() => {
    if (disputeId) dispatch(fetchDispute(disputeId));
  }, [disputeId, dispatch]);

  if (!dispute) {
    return (
      <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/20 p-3 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>Dispute submitted — loading status...</span>
      </div>
    );
  }

  if (dispute.status === "awaiting_proof") {
    return (
      <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 border border-warning/20 p-3 rounded-lg">
        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Your employer has until{" "}
          <strong className="font-semibold">
            {new Date(dispute.proofDeadline).toLocaleString()}
          </strong>{" "}
          to upload proof, or you'll be paid in full automatically.
        </p>
      </div>
    );
  }

  if (dispute.status === "under_review") {
    async function viewEvidence(publicId) {
      try {
        const { data } = await api.get(
          `/api/disputes/${dispute._id}/evidence/url`,
          {
            params: { publicId },
          },
        );
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err.response?.data?.error || "Failed to open file");
      }
    }

    return (
      <div className="flex flex-col gap-3 text-sm text-info bg-info/10 border border-info/20 p-3 rounded-lg">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Your employer submitted proof — an admin is now reviewing this
            dispute.
          </p>
        </div>

        {/* Worker can also view the evidence */}
        {dispute.evidencePublicIds?.length > 0 && (
          <div className="pl-6 flex flex-wrap gap-2 mt-1">
            <span className="text-xs font-bold text-base-content/60 uppercase w-full">
              Evidence provided:
            </span>
            {dispute.evidencePublicIds.map((id, i) => (
              <button
                key={id}
                onClick={() => viewEvidence(id)}
                className="btn btn-xs btn-outline border-info/30 hover:bg-info/20 hover:text-info-content text-info-content gap-1.5"
              >
                <FileText className="w-3 h-3 text-primary" /> File {i + 1}{" "}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isWorkerWin = dispute.ruledFor === "worker";
  return (
    <div
      className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${
        isWorkerWin
          ? "bg-success/10 text-success border-success/20"
          : "bg-error/10 text-error border-error/20"
      }`}
    >
      {isWorkerWin ? (
        <CheckCircle className="w-5 h-5 shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 shrink-0" />
      )}
      <p className="font-medium">
        Resolved in {isWorkerWin ? "your" : "the employer's"} favor.
      </p>
    </div>
  );
}

function ResolvedDisputeNote({ disputeId }) {
  const dispatch = useDispatch();
  const dispute = useSelector((state) => state.disputes.byId[disputeId]);

  useEffect(() => {
    if (disputeId) dispatch(fetchDispute(disputeId));
  }, [disputeId, dispatch]);

  if (!dispute) return null;

  const isWorkerWin = dispute.ruledFor === "worker";
  return (
    <div
      className={`p-3 rounded-xl border flex items-start gap-2 ${isWorkerWin ? "bg-success/10 border-success/20 text-success" : "bg-error/10 border-error/20 text-error"}`}
    >
      {isWorkerWin ? (
        <CheckCircle className="w-5 h-5 shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 shrink-0" />
      )}
      <div>
        <p className="font-bold text-sm">Dispute Resolved</p>
        <p className="text-xs opacity-90 mt-0.5">
          The admin ruled in {isWorkerWin ? "your" : "the employer's"} favour.
        </p>
      </div>
    </div>
  );
}

function ApplicationRow({ app }) {
  const dispatch = useDispatch();
  const [otpKey, setOtpKey] = useState(0);
  const [clockingIn, setClockingIn] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeLoading, setDisputeLoading] = useState(false);

  const record = app.shiftRecord;
  const reviewedKeys = useSelector((state) => state.reviews.reviewedKeys);
  const submitStatus = useSelector((state) => state.reviews.submitStatus);
  const [ratingOpen, setRatingOpen] = useState(false);

  async function handleClockIn(otp) {
    if (!app.shift?._id) return;
    setClockingIn(true);
    const result = await dispatch(clockIn({ shiftId: app.shift._id, otp }));
    setClockingIn(false);
    if (clockIn.rejected.match(result)) setOtpKey((k) => k + 1);
  }

  async function handleSubmitDispute({ reason, claimedTime }) {
    setDisputeLoading(true);
    await dispatch(
      raiseDispute({ shiftRecordId: record._id, reason, claimedTime }),
    );
    setDisputeLoading(false);
    setDisputeOpen(false);
  }

  async function handleSubmitRating({ rating, comment }) {
    const result = await dispatch(
      submitReview({
        shiftId: app.shift._id,
        revieweeId: app.shift.employer.user?._id || app.shift.employer.user,
        rating,
        comment,
      }),
    );
    if (submitReview.fulfilled.match(result)) {
      setRatingOpen(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden hover:border-primary/30 transition-colors">
      <div className="p-4 sm:p-5">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-2">
          <div>
            <Link
              to={`/shifts/${app.shift?._id}`}
              className="text-lg font-bold hover:text-primary transition-colors block"
            >
              {app.shift?.title || "Unknown Shift"}
            </Link>
            <div className="flex items-center gap-1.5 text-sm text-base-content/60 mt-1">
              <Building2 className="w-4 h-4 opacity-70 shrink-0" />
              <span>
                {app.shift?.employer?.businessName || "Unknown Employer"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`badge font-medium ${STATUS_STYLES[app.status] || "badge-ghost"}`}
            >
              {statusLabel(app)}
            </span>
            <WorkerCancelControl app={app} />
          </div>
        </div>

        <CancellationNote app={app} />

        {/* Contact Employer */}
        {["accepted", "in_progress", "pending_resolution", "disputed"].includes(
          app.status,
        ) && (
          <div className="mt-4">
            <ContactCard
              title="Contact person"
              name={app.shift?.employer?.user?.name}
              phone={app.shift?.employer?.user?.phone}
              role="employer"
            />
          </div>
        )}

        {/* Pre-shift / Check-in Actions */}
        {app.status === "accepted" && (
          <div className="mt-5 border-t border-base-200 pt-4">
            {app.escrowAmount > 0 && (
              <div className="inline-flex items-center gap-1.5 badge badge-accent badge-sm py-3 px-3 mb-4 font-medium">
                <IndianRupee className="w-3.5 h-3.5" />
                {app.escrowAmount} secured in escrow
              </div>
            )}

            {(!record || record.status === "scheduled") && (
              <div className="grid gap-4 sm:grid-cols-2 items-start">
                <div>
                  <ArrivalButton app={app} />
                </div>
                <div className="bg-base-200/50 p-3 rounded-lg border border-base-200">
                  <p className="text-xs font-medium opacity-70 mb-2 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Check-in code
                  </p>
                  <OtpInput
                    onComplete={handleClockIn}
                    disabled={clockingIn}
                    reset={otpKey}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ongoing Shift / Exit actions */}
        {app.status === "in_progress" && record?.status === "ongoing" && (
          <div className="mt-5 border-t border-base-200 pt-4">
            <ExitOtpPanel shiftId={app.shift._id} />
          </div>
        )}

        {/* Pending Resolution (Exit confirmation pending) */}
        {app.status === "pending_resolution" && record && (
          <div className="mt-5 border-t border-base-200 pt-4">
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-base-content/80 leading-relaxed">
                    Your employer force-closed your shift and recorded your exit
                    time at{" "}
                    <strong className="text-base-content">
                      {/* 👇 Yahan Exit Time add kiya gaya hai */}
                      {new Date(record.clockOut).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    .
                  </p>
                  <p className="text-sm text-base-content/80 leading-relaxed">
                    You'll be paid{" "}
                    <strong className="text-base-content">
                      ₹{record.amountEarned}
                    </strong>{" "}
                    for{" "}
                    <strong className="text-base-content">
                      {record.hoursWorked} hrs
                    </strong>
                    . If that doesn't match what actually happened, you can
                    dispute it until{" "}
                    <strong className="text-base-content">
                      {new Date(record.disputeWindowExpiresAt).toLocaleString()}
                    </strong>
                    .
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-1">
                <button
                  className="btn btn-sm btn-error btn-outline gap-2"
                  onClick={() => setDisputeOpen(true)}
                >
                  <Clock className="w-4 h-4" /> Dispute Exit Time
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disputed State */}
        {app.status === "disputed" && (
          <div className="mt-5 border-t border-base-200 pt-4">
            <DisputedWorkerPanel disputeId={app.dispute} />
          </div>
        )}

        {/* Completed State */}
        {app.status === "completed" && record && (
          <div className="mt-5 border-t border-base-200 pt-4 flex flex-col gap-4">
            {/* 👇 NAYA: Dispute Result Banner */}
            {app.dispute && <ResolvedDisputeNote disputeId={app.dispute} />}

            {/* 👇 NAYA: Auto-Closed by System Banner */}
            {record.exitMethod === "auto_cron" && (
              <div className="bg-info/10 border border-info/20 p-3 rounded-xl flex items-start gap-2 text-info">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Auto-Closed by System</p>
                  <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                    This shift was automatically closed because the scheduled
                    end time passed and you didn't generate an exit code.
                  </p>
                </div>
              </div>
            )}
            {record.exitMethod === "forced" && !app.dispute && (
              <div className="bg-warning/10 border border-warning/20 p-3 rounded-xl flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-warning" />
                <div>
                  <p className="font-bold text-sm text-warning">
                    Force Clock-Out Finalized
                  </p>
                  <p className="text-xs text-base-content/80 mt-0.5 leading-relaxed">
                    Your employer force-closed this shift and recorded your exit
                    time at{" "}
                    <strong className="text-base-content">
                      {new Date(record.clockOut).toLocaleString()}
                    </strong>
                    . Since you didn't dispute within 24 hours, the recorded
                    time was accepted. Payment of{" "}
                    <strong className="text-base-content">
                      ₹{record.amountEarned}
                    </strong>{" "}
                    has been released.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-success font-medium bg-success/10 px-3 py-2 rounded-lg border border-success/20 w-fit">
                <CheckCircle className="w-5 h-5" />
                <span>
                  Completed — ₹{record.amountEarned} earned (
                  {record.hoursWorked} hrs)
                </span>
              </div>

              {!reviewedKeys.includes(
                `${app.shift._id}:${app.shift?.employer?.user?._id || app.shift?.employer?.user}`,
              ) && (
                <button
                  className="btn btn-sm btn-outline hover:bg-base-200 hover:text-base-content gap-1.5 w-fit"
                  onClick={() => setRatingOpen(true)}
                >
                  <Star className="w-4 h-4" /> Rate Employer
                </button>
              )}
            </div>
          </div>
        )}

        <DisputeReasonModal
          open={disputeOpen}
          onSubmit={handleSubmitDispute}
          onCancel={() => setDisputeOpen(false)}
          isLoading={disputeLoading}
          employerExitTime={record?.clockOut} // 👈 Pass Employer's time
        />

        <RatingModal
          open={ratingOpen}
          revieweeName={app.shift?.employer?.businessName}
          isLoading={submitStatus === "loading"}
          onSubmit={handleSubmitRating}
          onCancel={() => setRatingOpen(false)}
        />
      </div>
    </div>
  );
}

// User-facing status filter chips. Values are group keys handled by the
// backend (see STATUS_GROUPS in server/src/routes/shifts.js).
const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "disputed", label: "Disputed" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "cancelled", label: "Cancelled" },
];

function MyApplications() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const {
    list: myApplications,
    listStatus: status,
    listHasMore,
    listPage,
    listTotal,
  } = useSelector((state) => state.applications);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const debouncedQuery = useDebouncedValue(searchQuery, 400);
  const hasSearch = debouncedQuery.trim().length > 0;
  const hasFilter = activeFilter !== "all";
  const hasAnyQuery = hasSearch || hasFilter;

  // Reviews only fetched once — independent of search/pagination
  useEffect(() => {
    dispatch(fetchMyReviews());
  }, [dispatch]);

  // Fetch applications on mount + when search or filter changes.
  // Any change resets to page 1.
  useEffect(() => {
    dispatch(
      fetchMyApplications({
        page: 1,
        limit: 20,
        q: debouncedQuery.trim() || undefined,
        status: activeFilter !== "all" ? activeFilter : undefined,
      }),
    );
  }, [dispatch, debouncedQuery, activeFilter]);

  function handleLoadMore() {
    if (!listHasMore || status === "loading") return;
    dispatch(
      fetchMyApplications({
        page: listPage + 1,
        limit: 20,
        q: debouncedQuery.trim() || undefined,
        status: activeFilter !== "all" ? activeFilter : undefined,
        append: true,
      }),
    );
  }

  // Fallback for non-workers
  if (user?.role !== "worker") {
    return (
      <div className="min-h-screen bg-base-200/50 p-6 flex flex-col items-center justify-center text-center">
        <Briefcase className="w-16 h-16 text-base-content/20 mb-4" />
        <p className="opacity-70 text-lg">
          This page is only available for worker accounts.
        </p>
      </div>
    );
  }

  // Initial loading (only when list is truly empty — search/load-more don't
  // blank the page)
  if (status === "loading" && myApplications.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-base-content/70">Loading your applications...</p>
      </div>
    );
  }

    // Empty state (only when NO search AND NO filter — otherwise we show
  // "no matches" inline in the main render so the controls stay visible)
  if (!myApplications || (myApplications.length === 0 && !hasAnyQuery)) {
    return (
      <div className="min-h-[80vh] bg-base-200/50 p-6 flex flex-col items-center justify-center text-center">
        <div className="bg-base-100 p-8 rounded-2xl shadow-sm border border-base-200 max-w-md w-full">
          <Search className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No applications yet</h2>
          <p className="text-base-content/70 mb-6">
            You haven't applied to any shifts yet. Start exploring available
            opportunities.
          </p>
          <Link to="/worker" className="btn btn-primary w-full">
            Browse shifts
          </Link>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            My Applications
          </h1>
          <p className="text-base-content/70 mt-1">
            Track and manage your shift applications.
          </p>
        </div>

                <VerificationBanner />
        {/* Search + Filter */}
        <div className="bg-base-100 rounded-2xl border border-base-200 p-3 shadow-sm space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by shift title or employer…"
              className="input input-sm input-bordered w-full pl-9 pr-9 rounded-lg bg-base-100 text-sm"
            />
            {status === "loading" && !myApplications.length ? (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-base-content/40" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-base-200 text-base-content/40"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Filter chips — horizontal scroll on mobile */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-colors ${
                  activeFilter === f.value
                    ? "bg-primary text-primary-content shadow-sm"
                    : "bg-base-200/60 text-base-content/70 hover:bg-base-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Result count hint — only when filters or search active */}
          {hasAnyQuery && (
            <p className="text-xs text-base-content/60 px-1">
              {myApplications.length} result{myApplications.length === 1 ? "" : "s"}
              {hasSearch && <> for "{debouncedQuery}"</>}
              {hasFilter && (
                <>
                  {" "}in{" "}
                  <span className="font-semibold">
                    {FILTERS.find((f) => f.value === activeFilter)?.label}
                  </span>
                </>
              )}
              {listTotal > myApplications.length &&
                ` (showing ${myApplications.length} of ${listTotal})`}
            </p>
          )}
        </div>

        {/* Metrics/Stats Card */}
        <div className="card bg-base-100 shadow-sm border border-base-200 p-5">
          <h2 className="text-sm font-bold text-base-content/60 uppercase tracking-wider mb-3">
            Account Status
          </h2>
          <StrikeMeter strikes={user?.strikes ?? 0} />
        </div>

        {/* No results for active search / filter */}
        {myApplications.length === 0 && hasAnyQuery && (
          <div className="bg-base-100 rounded-2xl border border-base-200 p-8 text-center flex flex-col items-center">
            <Search className="w-10 h-10 text-base-content/20 mb-2" />
            <h3 className="text-base font-bold">No matches</h3>
            <p className="text-xs text-base-content/60 mt-0.5 max-w-xs">
              {hasSearch && hasFilter
                ? `No ${FILTERS.find((f) => f.value === activeFilter)?.label.toLowerCase()} applications match "${debouncedQuery}".`
                : hasSearch
                  ? `No applications match "${debouncedQuery}".`
                  : `No applications with status "${FILTERS.find((f) => f.value === activeFilter)?.label}".`}
              {" "}
              Try a different filter or search term.
            </p>
            {(hasSearch || hasFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("all");
                }}
                className="btn btn-outline btn-sm rounded-xl mt-3 gap-1.5"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Applications List */}
        <div className="flex flex-col gap-4">
          {myApplications.map((app) => (
            <ApplicationRow key={app._id} app={app} />
          ))}
        </div>

        {/* Load More */}
        {listHasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={status === "loading"}
              className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
            >
              {status === "loading" && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {status === "loading" ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {/* End-of-list indicator */}
        {!listHasMore && myApplications.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {myApplications.length} application
            {myApplications.length === 1 ? "" : "s"} shown
          </p>
        )}
      </div>
    </div>
  );
}

export default MyApplications;
