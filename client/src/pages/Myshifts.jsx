// client/src/pages/MyShifts.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useSearchParams } from "react-router";
import { Helmet } from "react-helmet-async";
import toast from "react-hot-toast";
import { useLiveTick } from "../hooks/useLiveTick";
import {
  fetchMyShifts,
  fetchApplicants,
  updateApplicationStatus,
  cancelShift,
  employerCancelApplication,
  markNoShow,
  employerClockOut,
  forceClockOut,
  fetchEmployerStats,
} from "../store/employerShiftsSlice";
import { fetchWalletSummary } from "../store/walletSlice";
import { submitReview, fetchMyReviews } from "../store/reviewsSlice";
import { fetchDispute, submitDisputeEvidence } from "../store/disputesSlice";
import EditShiftModal from "../components/EditShiftModal";
import ConfirmActionModal from "../components/ConfirmActionModal";
import OtpInput from "../components/OtpInput";
import OtpPanel from "../components/OtpPanel";
import ForceClockOutModal from "../components/ForceClockOutModal";
import RatingModal from "../components/RatingModal";
import ContactCard from "../components/ContactCard";
import DisputeEvidenceModal from "../components/DisputeEvidenceModal";
import { TopupPromptModal } from "../components/TopupPromptModal";
import {
  LATE_CANCELLATION_WINDOW_HOURS,
  LATE_CANCELLATION_PENALTY_FLAT,
} from "../constants/businessRule";
import {
  Briefcase,
  Users,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Edit3,
  Star,
  Loader2,
  CheckCircle2,
  Clock,
  Info,
  AlertTriangle,
  ShieldAlert,
  Search,
  X,
  PlusCircle,
  Eye,
} from "lucide-react";

function computeEscrowPaise(shift) {
  const start = new Date(shift.startTime).getTime();
  const end = new Date(shift.endTime).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours * shift.hourlyPay);
}

/* ── applicant sub-components (unchanged) ── */
function ExitOtpEntry({ shift, app, onForceClockOut }) {
  const dispatch = useDispatch();
  const [otpKey, setOtpKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete(otp) {
    setSubmitting(true);
    const result = await dispatch(
      employerClockOut({ shiftId: shift._id, workerId: app.worker._id, otp }),
    );
    setSubmitting(false);
    if (employerClockOut.rejected.match(result)) setOtpKey((k) => k + 1);
  }

  return (
    <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full sm:w-auto">
      <span className="text-xs font-semibold text-base-content/70 w-full sm:w-auto">
        Exit code:
      </span>
      <OtpInput
        onComplete={handleComplete}
        disabled={submitting}
        reset={otpKey}
      />
      <button
        type="button"
        className="btn btn-xs btn-outline btn-error rounded-lg"
        onClick={onForceClockOut}
      >
        Force Out
      </button>
    </div>
  );
}

function DisputedApplicantPanel({ app }) {
  const dispatch = useDispatch();
  const dispute = useSelector((state) => state.disputes.byId[app.dispute]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => {
    if (app.dispute) dispatch(fetchDispute(app.dispute));
  }, [app.dispute, dispatch]);

  async function handleSubmitEvidence(files) {
    setEvidenceLoading(true);
    await dispatch(submitDisputeEvidence({ disputeId: app.dispute, files }));
    setEvidenceLoading(false);
    setEvidenceOpen(false);
  }

  if (!dispute)
    return <Loader2 className="w-4 h-4 animate-spin text-primary" />;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:justify-end">
      <p className="text-xs text-base-content/80 italic bg-base-100 px-3 py-2 rounded-lg border border-base-200 flex-1 sm:flex-none sm:max-w-xs w-full sm:w-auto">
        "{dispute.reason}"
      </p>
      {dispute.status === "awaiting_proof" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-warning font-semibold">
            Due: {new Date(dispute.proofDeadline).toLocaleString()}
          </span>
          <button
            type="button"
            className="btn btn-xs btn-primary rounded-lg shrink-0"
            onClick={() => setEvidenceOpen(true)}
          >
            Upload Proof
          </button>
        </div>
      ) : dispute.status === "under_review" ? (
        <span className="text-xs text-warning font-semibold shrink-0">
          Awaiting review
        </span>
      ) : (
        <span
          className={`badge badge-sm font-bold gap-1 shrink-0 py-2.5 px-3 ${
            dispute.ruledFor === "employer"
              ? "badge-success text-success-content"
              : "badge-error text-error-content"
          }`}
        >
          {dispute.ruledFor === "employer" ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Ruled in Your Favor
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" /> Ruled in Worker's Favor
            </>
          )}
        </span>
      )}
      <DisputeEvidenceModal
        open={evidenceOpen}
        onSubmit={handleSubmitEvidence}
        onCancel={() => setEvidenceOpen(false)}
        isLoading={evidenceLoading}
        disputeDeadline={dispute.proofDeadline}
      />
    </div>
  );
}

function ForceClockOutFinalizedPanel({ app }) {
  const record = app.shiftRecord;
  if (!record || record.exitMethod !== "forced" || app.dispute) return null;

  return (
    <div className="w-full mt-2 p-3 bg-warning/10 border border-warning/20 rounded-xl space-y-1.5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-warning" />
        <p className="text-xs font-bold text-warning uppercase tracking-wider">
          Force Clock-Out Finalized
        </p>
      </div>
      <p className="text-sm text-base-content/80 leading-relaxed">
        You force-closed this shift at{" "}
        <strong className="text-base-content">
          {new Date(record.clockOut).toLocaleString()}
        </strong>{" "}
        ({record.hoursWorked} hrs). The worker did not dispute within 24 hours,
        so the recorded exit time was accepted.
      </p>
      <p className="text-xs text-base-content/60">
        <strong>Payout:</strong> ₹{record.amountEarned} released to worker
        {record.employerRefund > 0 && (
          <>
            {" "}
            • <strong>Refund:</strong> ₹{record.employerRefund} back to you
          </>
        )}
      </p>
    </div>
  );
}

function ResolvedDisputePanel({ app }) {
  const dispatch = useDispatch();
  const dispute = useSelector((state) => state.disputes.byId[app.dispute]);

  useEffect(() => {
    if (app.dispute && !dispute) {
      dispatch(fetchDispute(app.dispute));
    }
  }, [app.dispute, dispute, dispatch]);

  if (!dispute) return null;

  const isEmployerWin = dispute.ruledFor === "employer";

  return (
    <div
      className={`w-full mt-2 p-3 rounded-xl border flex flex-col gap-2 ${
        isEmployerWin
          ? "bg-success/10 border-success/20"
          : "bg-error/10 border-error/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {isEmployerWin ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-error" />
        )}
        <p
          className={`text-xs font-bold uppercase tracking-wider ${
            isEmployerWin ? "text-success" : "text-error"
          }`}
        >
          Dispute Resolved - {isEmployerWin ? "You Won" : "Worker Won"}
        </p>
      </div>
      <div className="text-sm text-base-content/80 leading-relaxed space-y-1">
        <p>
          The worker claimed their exit time was{" "}
          <strong className="text-base-content">
            {new Date(dispute.workerClaimedClockOut).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          .
        </p>
        {dispute.resolution && (
          <p className="bg-base-100/50 p-2 rounded-lg border border-base-content/10 mt-2">
            <strong className="text-base-content">Admin Note:</strong> "
            {dispute.resolution}"
          </p>
        )}
      </div>
    </div>
  );
}

/* ── constants ── */
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

const LOCKED_OUT_STATUSES = [
  "in_progress",
  "pending_resolution",
  "disputed",
  "completed",
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "filled", label: "Filled" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 10;

/* ── main ── */
function MyShifts() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { myShifts, applicantsByShift } = useSelector(
    (state) => state.employerShifts,
  );
  const walletSummary = useSelector((state) => state.wallet.summary);
  const reviewedKeys = useSelector((state) => state.reviews.reviewedKeys);
  const submitStatus = useSelector((state) => state.reviews.submitStatus);

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkShiftId = searchParams.get("shift");
  const deepLinkApplied = useRef(null);

  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [forceClockOutTarget, setForceClockOutTarget] = useState(null);
  const [forceClockOutLoading, setForceClockOutLoading] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [insufficientFunds, setInsufficientFunds] = useState(null);

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const liveTick = useLiveTick("shifts:changed");

  useEffect(() => {
    dispatch(fetchMyShifts());
    dispatch(fetchMyReviews());
    dispatch(fetchWalletSummary());
  }, [dispatch, liveTick]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, searchQuery]);

  // ✅ NEW: deep-link from EmployerDashboard / ShiftDetail — auto-expand
  // target shift + scroll it into view, then STRIP the ?shift= param so the
  // URL stays clean (`/my-shifts` instead of `/my-shifts?shift=507f...`).
  useEffect(() => {
    if (!deepLinkShiftId) return;
    if (deepLinkApplied.current === deepLinkShiftId) return;
    if (myShifts.length === 0) return;
    deepLinkApplied.current = deepLinkShiftId;

    if (myShifts.some((s) => s._id === deepLinkShiftId)) {
      setExpandedShiftId(deepLinkShiftId);
      if (!applicantsByShift[deepLinkShiftId]) {
        dispatch(fetchApplicants(deepLinkShiftId));
      }
      setTimeout(() => {
        const el = document.getElementById(`shift-${deepLinkShiftId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }

    // Strip the query param WITHOUT adding a history entry, so the back
    // button still returns to ShiftDetail.
    setSearchParams({}, { replace: true });
  }, [deepLinkShiftId, myShifts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myShifts.filter((s) => {
      if (filter === "active" && !["open", "filled"].includes(s.status))
        return false;
      if (filter !== "all" && filter !== "active" && s.status !== filter)
        return false;
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [myShifts, filter, searchQuery]);

  const visibleShifts = filteredShifts.slice(0, visibleCount);
  const hasMore = filteredShifts.length > visibleCount;

  if (user && user.role !== "employer") {
    return <Navigate to="/dashboard" replace />;
  }

  function toggleApplicants(shiftId) {
    if (expandedShiftId === shiftId) return setExpandedShiftId(null);
    setExpandedShiftId(shiftId);
    if (!applicantsByShift[shiftId]) dispatch(fetchApplicants(shiftId));
  }

  function handleStatusChange(shiftId, applicationId, status) {
    dispatch(updateApplicationStatus({ shiftId, applicationId, status }));
  }

  function openAcceptConfirm(shift, app) {
    const escrowPaise = computeEscrowPaise(shift);
    if (!escrowPaise) {
      toast.error("Could not compute escrow — check shift timing");
      return;
    }
    setConfirmModal({
      type: "accept",
      shift,
      app,
      title: "Accept this worker?",
      body: `₹${(escrowPaise / 100).toFixed(2)} will be locked from your wallet immediately to secure their pay for this shift.`,
      confirmLabel: "Accept & Lock Funds",
      variant: "primary",
    });
  }

  function openEmployerCancelConfirm(shift, app) {
    const hoursUntilStart =
      (new Date(shift.startTime) - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntilStart < LATE_CANCELLATION_WINDOW_HOURS;
    const escrow = app.escrowAmount ?? 0;
    const penalty = isLate
      ? Math.min(LATE_CANCELLATION_PENALTY_FLAT, escrow)
      : 0;
    const refund = +(escrow - penalty).toFixed(2);
    setConfirmModal({
      type: "employerCancel",
      shift,
      app,
      title: "Cancel this worker?",
      body: isLate
        ? `Inside the ${LATE_CANCELLATION_WINDOW_HOURS}h window — ₹${penalty} penalty goes to the worker, ₹${refund} refunded.`
        : `Outside the window — full ₹${refund} refunded, no penalty.`,
      confirmLabel: "Cancel Worker",
      variant: "error",
    });
  }

  function openNoShowConfirm(shift, app) {
    setConfirmModal({
      type: "noShow",
      shift,
      app,
      title: "Mark as no-show?",
      body: `₹${app.escrowAmount ?? 0} refunded in full, and worker receives a strike.`,
      confirmLabel: "Mark No-Show",
      variant: "error",
    });
  }

  function openCancelShiftConfirm(shift) {
    setConfirmModal({
      type: "cancelShift",
      shift,
      app: null,
      title: "Cancel entire shift?",
      body: "All accepted workers are refunded/penalized accordingly, and the shift closes.",
      confirmLabel: "Cancel Shift",
      variant: "error",
    });
  }

  async function handleForceClockOutConfirm(exitTimeIso) {
    if (!forceClockOutTarget) return;
    const { shift, app } = forceClockOutTarget;
    setForceClockOutLoading(true);
    await dispatch(
      forceClockOut({
        shiftId: shift._id,
        applicationId: app._id,
        exitTime: exitTimeIso,
      }),
    );
    setForceClockOutLoading(false);
    setForceClockOutTarget(null);
  }

  async function handleSubmitRating({ rating, comment }) {
    if (!ratingTarget) return;
    const result = await dispatch(
      submitReview({
        shiftId: ratingTarget.shiftId,
        revieweeId: ratingTarget.revieweeId,
        rating,
        comment,
      }),
    );
    if (submitReview.fulfilled.match(result)) setRatingTarget(null);
  }

  async function handleConfirm() {
    if (!confirmModal) return;
    const { type, shift, app } = confirmModal;
    setConfirmLoading(true);
    try {
      if (type === "accept") {
        const escrowPaise = computeEscrowPaise(shift);
        if (!escrowPaise) {
          toast.error("Could not compute escrow — check shift timing");
          return;
        }

        const balancePaise = Math.round(
          (walletSummary?.balance ?? user?.walletBalance ?? 0) * 100,
        );

        if (balancePaise < escrowPaise) {
          setInsufficientFunds({
            requiredAmount: escrowPaise / 100,
            currentBalance: balancePaise / 100,
          });
          return;
        }

        const result = await dispatch(
          updateApplicationStatus({
            shiftId: shift._id,
            applicationId: app._id,
            status: "accepted",
            silent: true,
          }),
        );

        if (updateApplicationStatus.fulfilled.match(result)) {
          dispatch(fetchApplicants(shift._id));
          dispatch(fetchWalletSummary());
          dispatch(fetchEmployerStats());
        } else {
          const msg = String(result.payload || "").toLowerCase();
          if (msg.includes("insufficient")) {
            setInsufficientFunds({
              requiredAmount: escrowPaise / 100,
              currentBalance: balancePaise / 100,
            });
          } else {
            toast.error(result.payload || "Could not accept worker");
          }
        }
      } else if (type === "employerCancel") {
        await dispatch(
          employerCancelApplication({
            shiftId: shift._id,
            applicationId: app._id,
          }),
        );
        dispatch(fetchApplicants(shift._id));
        dispatch(fetchWalletSummary());
      } else if (type === "noShow") {
        await dispatch(
          markNoShow({ shiftId: shift._id, applicationId: app._id }),
        );
        dispatch(fetchApplicants(shift._id));
        dispatch(fetchWalletSummary());
      } else if (type === "cancelShift") {
        await dispatch(cancelShift(shift._id));
        dispatch(fetchWalletSummary());
        if (applicantsByShift[shift._id]) dispatch(fetchApplicants(shift._id));
      }
    } finally {
      setConfirmLoading(false);
      setConfirmModal(null);
    }
  }

  return (
    <div className="min-h-screen bg-base-200/50 p-3 sm:p-5 lg:p-6 animate-fade-in">
      <Helmet>
        <title>My Shifts — Shyftra</title>
      </Helmet>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-base-content tracking-tight">
                My Shifts
              </h1>
              <p className="text-xs sm:text-sm text-base-content/60">
                {myShifts.length} total · {filteredShifts.length} matching
              </p>
            </div>
          </div>
          <Link
            to="/employer"
            className="btn btn-primary btn-sm rounded-xl gap-1.5 shadow-sm shadow-primary/20 w-full sm:w-auto"
          >
            <PlusCircle className="w-4 h-4" /> Post a Shift
          </Link>
        </div>

        {/* search + filters */}
        <div className="bg-base-100 rounded-2xl border border-base-200 p-3 shadow-sm space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title…"
              className="input input-sm input-bordered w-full pl-9 pr-9 rounded-lg bg-base-100 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-base-200 text-base-content/40"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-colors ${
                  filter === f.value
                    ? "bg-primary text-primary-content shadow-sm"
                    : "bg-base-200/60 text-base-content/70 hover:bg-base-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* list */}
        {visibleShifts.length === 0 ? (
          <div className="bg-base-100 rounded-2xl border border-base-200 p-8 text-center flex flex-col items-center">
            <Briefcase className="w-10 h-10 text-base-content/20 mb-2" />
            <h3 className="text-base font-bold">
              {myShifts.length === 0
                ? "No shifts posted yet"
                : "No shifts match your filters"}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5 max-w-xs">
              {myShifts.length === 0
                ? "Post your first hourly shift to connect with verified workers."
                : "Try a different filter or search term."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleShifts.map((shift) => (
              <div
                key={shift._id}
                // ✅ id attribute used by deep-link scroll-into-view
                id={`shift-${shift._id}`}
                className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 transition-all hover:border-primary/30"
              >
                {/* ─── Shift card header ─── */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1 min-w-0 w-full sm:w-auto">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-base text-base-content truncate">
                        {shift.title}
                      </h3>
                      <span
                        className={`badge font-medium uppercase px-2 py-1 text-[10px] shrink-0 ${
                          shift.status === "open"
                            ? "badge-success"
                            : shift.status === "filled"
                              ? "badge-info"
                              : shift.status === "completed"
                                ? "badge-success"
                                : shift.status === "expired"
                                  ? "badge-ghost"
                                  : "badge-error"
                        }`}
                      >
                        {shift.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/70 font-medium">
                      <span className="flex items-center gap-0.5 text-primary font-bold whitespace-nowrap">
                        <IndianRupee className="w-3 h-3" />{" "}
                        {(shift.hourlyPay / 100).toFixed(0)}/hr
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Users className="w-3 h-3" /> {shift.workersNeeded} slot
                        {shift.workersNeeded > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end shrink-0">
                    {/* ✅ NEW: opens role-aware ShiftDetail. Employer will
                        see their own shift's detail with a "Manage this
                        shift" CTA back to this page's deep-link. */}
                    <Link
                      to={`/shifts/${shift._id}`}
                      className="btn btn-sm btn-outline border-base-300 rounded-xl gap-1 flex-1 sm:flex-none"
                      title="View public shift page"
                    >
                      <Eye className="w-3.5 h-3.5 text-base-content/70" />
                      <span className="hidden xs:inline">View</span>
                    </Link>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline border-base-300 rounded-xl gap-1 flex-1 sm:flex-none"
                      onClick={() => toggleApplicants(shift._id)}
                    >
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden xs:inline">Applicants</span>
                      <span className="xs:hidden">Expand</span>
                      {expandedShiftId === shift._id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {(shift.status === "open" || shift.status === "filled") && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline border-base-300 rounded-xl gap-1 flex-1 sm:flex-none"
                        onClick={() => {
                          if (!applicantsByShift[shift._id])
                            dispatch(fetchApplicants(shift._id));
                          setEditTarget(shift);
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-base-content/70" />{" "}
                        Edit
                      </button>
                    )}

                    {(shift.status === "open" || shift.status === "filled") &&
                      !applicantsByShift[shift._id]?.some((a) =>
                        LOCKED_OUT_STATUSES.includes(a.status),
                      ) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline btn-error rounded-xl flex-1 sm:flex-none"
                          onClick={() => openCancelShiftConfirm(shift)}
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>

                {/* ─── Applicants Expanded Drawer ─── */}
                {expandedShiftId === shift._id && (
                  <div className="mt-4 pt-4 border-t border-base-200 space-y-3 animate-fade-in">
                    <h4 className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider">
                      Workforce Management
                    </h4>

                    {(applicantsByShift[shift._id]?.length ?? 0) === 0 ? (
                      <div className="p-5 text-center bg-base-200/40 rounded-xl border border-base-200">
                        <p className="text-xs text-base-content/60 font-medium">
                          No applicants for this shift yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {applicantsByShift[shift._id].map((app) => {
                          const shiftHasStarted =
                            new Date() > new Date(shift.startTime);
                          const isContactVisible = [
                            "accepted",
                            "in_progress",
                            "pending_resolution",
                            "disputed",
                          ].includes(app.status);

                          return (
                            <div
                              key={app._id}
                              className="bg-base-200/40 rounded-xl p-3 sm:p-4 border border-base-200 space-y-3"
                            >
                              {/* Applicant identity row */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 overflow-hidden border border-primary/10">
                                    {app.worker?.avatarUrl ? (
                                      <img
                                        src={app.worker.avatarUrl}
                                        alt={app.worker.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="font-extrabold text-primary text-sm">
                                        {app.worker?.name
                                          ?.charAt(0)
                                          ?.toUpperCase() || "?"}
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0 space-y-0.5 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-base-content text-sm truncate max-w-full">
                                        {app.worker?.name || "Worker"}
                                      </p>
                                      {app.workerProfile?.rating ? (
                                        <span className="text-[11px] font-semibold text-warning flex items-center gap-0.5 bg-warning/10 px-1.5 py-0.5 rounded shrink-0">
                                          <Star className="w-3 h-3 fill-warning text-warning" />
                                          {app.workerProfile.rating}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-medium text-base-content/50 bg-base-300/50 px-1.5 py-0.5 rounded shrink-0">
                                          New
                                        </span>
                                      )}
                                      {app.worker?.strikes > 0 && (
                                        <span className="badge badge-error badge-xs font-bold shrink-0">
                                          {app.worker.strikes} strike
                                          {app.worker.strikes > 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>

                                    {app.workerProfile?.skills?.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {app.workerProfile.skills
                                          .slice(0, 3)
                                          .map((s) => (
                                            <span
                                              key={s}
                                              className="badge badge-outline border-base-300 text-[10px] py-0 px-1.5 font-medium truncate max-w-20"
                                            >
                                              {s}
                                            </span>
                                          ))}
                                        {app.workerProfile.skills.length >
                                          3 && (
                                          <span className="badge badge-ghost text-[10px] py-0 px-1.5 shrink-0">
                                            +
                                            {app.workerProfile.skills.length -
                                              3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <span
                                  className={`badge font-medium uppercase px-2.5 py-1 text-[10px] shrink-0 ${STATUS_STYLES[app.status] || "badge-ghost"}`}
                                >
                                  {app.status === "cancelled_by_worker" &&
                                  app.noShow
                                    ? "no show"
                                    : app.status === "cancelled_by_worker" &&
                                        app.cancellationReason ===
                                          "Worker account was banned"
                                      ? "Worker Suspended"
                                      : app.status.replaceAll("_", " ")}
                                </span>
                              </div>

                              {/* Application message */}
                              {app.message && (
                                <p className="text-xs italic text-base-content/80 bg-base-100 p-2.5 rounded-lg border border-base-200 w-full wrap-break-word">
                                  "{app.message}"
                                </p>
                              )}

                              {/* Contact card */}
                              {isContactVisible && app.worker?.phone && (
                                <div className="w-full">
                                  <ContactCard
                                    title="Worker Contact Information"
                                    name={app.worker.name}
                                    phone={app.worker.phone}
                                    role="worker"
                                  />
                                </div>
                              )}

                              {/* Success badges */}
                              <div className="flex flex-wrap gap-2 text-xs">
                                {app.status === "accepted" && app.arrivedAt && (
                                  <span className="badge badge-xs badge-success badge-outline gap-1 font-medium py-2">
                                    <CheckCircle2 className="w-3 h-3" /> Arrived{" "}
                                    {new Date(app.arrivedAt).toLocaleTimeString(
                                      [],
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </span>
                                )}
                                {app.status === "accepted" &&
                                  app.escrowAmount > 0 && (
                                    <span className="badge badge-xs badge-accent font-bold gap-1 py-2">
                                      <IndianRupee className="w-3 h-3" /> ₹
                                      {app.escrowAmount} secured
                                    </span>
                                  )}
                              </div>

                              {/* Action buttons — per status */}
                              <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end pt-2 border-t border-base-200/80 w-full">
                                {app.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-xs sm:btn-sm btn-outline btn-error rounded-lg flex-1 sm:flex-none"
                                      onClick={() =>
                                        handleStatusChange(
                                          shift._id,
                                          app._id,
                                          "rejected",
                                        )
                                      }
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-xs sm:btn-sm btn-primary rounded-lg shadow-sm flex-1 sm:flex-none"
                                      onClick={() =>
                                        openAcceptConfirm(shift, app)
                                      }
                                    >
                                      Accept
                                    </button>
                                  </>
                                )}

                                {app.status === "accepted" && (
                                  <div className="flex flex-wrap items-center gap-2 w-full justify-end">
                                    <OtpPanel
                                      shiftId={shift._id}
                                      workerId={app.worker._id}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-xs sm:btn-sm btn-outline rounded-lg flex-1 sm:flex-none"
                                      onClick={() =>
                                        openEmployerCancelConfirm(shift, app)
                                      }
                                    >
                                      Cancel
                                    </button>
                                    {shiftHasStarted && (
                                      <button
                                        type="button"
                                        className="btn btn-xs sm:btn-sm btn-outline btn-error rounded-lg flex-1 sm:flex-none"
                                        onClick={() =>
                                          openNoShowConfirm(shift, app)
                                        }
                                      >
                                        No-Show
                                      </button>
                                    )}
                                  </div>
                                )}

                                {app.status === "in_progress" && (
                                  <ExitOtpEntry
                                    shift={shift}
                                    app={app}
                                    onForceClockOut={() =>
                                      setForceClockOutTarget({ shift, app })
                                    }
                                  />
                                )}

                                {app.status === "pending_resolution" &&
                                  app.shiftRecord && (
                                    <div className="w-full mt-2 p-3 bg-warning/10 border border-warning/20 rounded-xl space-y-1.5 text-left">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-warning" />
                                        <p className="text-xs font-bold text-warning uppercase tracking-wider">
                                          Force Closed - Pending Resolution
                                        </p>
                                      </div>
                                      <p className="text-sm text-base-content/80 leading-relaxed">
                                        You recorded the exit time as{" "}
                                        <strong className="text-base-content">
                                          {new Date(
                                            app.shiftRecord.clockOut,
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </strong>{" "}
                                        ({app.shiftRecord.hoursWorked} hrs).
                                        Proposed payout is{" "}
                                        <strong className="text-base-content">
                                          ₹{app.shiftRecord.amountEarned}
                                        </strong>
                                        .
                                      </p>
                                      <p className="text-xs text-base-content/60 flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                        Worker can dispute this until{" "}
                                        {new Date(
                                          app.shiftRecord
                                            .disputeWindowExpiresAt,
                                        ).toLocaleString()}
                                        .
                                      </p>
                                    </div>
                                  )}

                                {app.status === "disputed" && (
                                  <DisputedApplicantPanel app={app} />
                                )}

                                {app.status === "completed" && app.dispute && (
                                  <ResolvedDisputePanel app={app} />
                                )}

                                {app.status === "completed" && !app.dispute && (
                                  <ForceClockOutFinalizedPanel app={app} />
                                )}

                                {app.status === "completed" && (
                                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto mt-2">
                                    {app.shiftRecord?.exitMethod ===
                                      "auto_cron" && (
                                      <span className="badge badge-info badge-outline gap-1 font-medium py-2.5 px-3">
                                        <Info className="w-3.5 h-3.5" />{" "}
                                        Auto-Closed by System
                                      </span>
                                    )}

                                    {!reviewedKeys.includes(
                                      `${shift._id}:${app.worker._id}`,
                                    ) && (
                                      <button
                                        type="button"
                                        className="btn btn-xs sm:btn-sm btn-primary btn-outline rounded-lg gap-1 w-full sm:w-auto"
                                        onClick={() =>
                                          setRatingTarget({
                                            shiftId: shift._id,
                                            revieweeId: app.worker._id,
                                            revieweeName: app.worker.name,
                                          })
                                        }
                                      >
                                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />{" "}
                                        Rate Worker
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm rounded-xl gap-2 min-w-40"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Show more ({filteredShifts.length - visibleCount} left)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* modals */}
      <ConfirmActionModal
        open={!!confirmModal}
        title={confirmModal?.title}
        body={confirmModal?.body}
        confirmLabel={confirmModal?.confirmLabel}
        variant={confirmModal?.variant}
        isLoading={confirmLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      <ForceClockOutModal
        open={!!forceClockOutTarget}
        isLoading={forceClockOutLoading}
        onConfirm={handleForceClockOutConfirm}
        onCancel={() => setForceClockOutTarget(null)}
      />
      {editTarget && (
        <EditShiftModal
          shift={editTarget}
          hasApplicants={(applicantsByShift[editTarget._id] ?? []).some((a) =>
            [
              "pending",
              "accepted",
              "in_progress",
              "pending_resolution",
              "disputed",
              "completed",
            ].includes(a.status),
          )}
          onClose={() => setEditTarget(null)}
        />
      )}
      <RatingModal
        open={!!ratingTarget}
        revieweeName={ratingTarget?.revieweeName}
        isLoading={submitStatus === "loading"}
        onSubmit={handleSubmitRating}
        onCancel={() => setRatingTarget(null)}
      />
      <TopupPromptModal
        open={!!insufficientFunds}
        requiredAmount={insufficientFunds?.requiredAmount}
        currentBalance={insufficientFunds?.currentBalance}
        context="accept_worker"
        onClose={() => setInsufficientFunds(null)}
      />
    </div>
  );
}

export default MyShifts;
