// client/src/hooks/useSocketEvents.js
// Every real-time event the backend emits, handled in one place.
// Each handler does two things: tell the user (toast), and refresh whichever
// slice of Redux the event makes stale — so open dashboards update live.
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  ShieldAlert,
  Hourglass,
  Wallet,
  Timer,
  Inbox,
  MapPin,
  Search,
  PartyPopper,
  Star,
} from "lucide-react";
import { socket } from "../socket";
import {
  applicationStatusChanged,
  fetchMyApplications,
} from "../store/applicationsSlice";
import {
  fetchApplicants,
  fetchMyShifts,
  fetchEmployerStats,
  workerArrived,
} from "../store/employerShiftsSlice";
import { fetchWalletSummary } from "../store/walletSlice";
import { fetchMyDisputes, fetchDispute } from "../store/disputesSlice";
import {
  fetchEarningsSummary,
  fetchShiftHistory,
} from "../store/earningsSlice";
import { fetchMe } from "../store/authSlice";
import { fetchProfile } from "../store/profileSlice";
import { submitReview, fetchMyReviews } from "../store/reviewsSlice";

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Small helper so every toast message renders with a leading lucide icon.
const withIcon = (Icon, text, className = "w-4 h-4 shrink-0") => (
  <span className="flex items-center gap-2">
    <Icon className={className} />
    <span>{text}</span>
  </span>
);

export function useSocketEvents() {
  const dispatch = useDispatch();
  const { user, authChecked } = useSelector((state) => state.auth);
  const applicantsByShift = useSelector(
    (state) => state.employerShifts.applicantsByShift || {},
  );

  const applicantsRef = useRef(applicantsByShift);
  useEffect(() => {
    applicantsRef.current = applicantsByShift;
  }, [applicantsByShift]);

  const role = user?.role;

  useEffect(() => {
    if (!authChecked) return undefined;

    let workerTimer = null;
    let employerTimer = null;

    const refreshWorkerNow = () => {
      if (!role) return;
      dispatch(fetchMyApplications());
      dispatch(fetchWalletSummary());
      dispatch(fetchEarningsSummary());
      dispatch(fetchShiftHistory());
      dispatch(fetchMe());
    };

    const refreshEmployerNow = (shiftId) => {
      if (!role) return;

      dispatch(fetchMyShifts());
      dispatch(fetchWalletSummary());
      dispatch(fetchEmployerStats()); // ← keeps dashboard counters live
      if (shiftId && applicantsRef.current[shiftId])
        dispatch(fetchApplicants(shiftId));
      dispatch(fetchMe());
    };

    const notifyTxChanged = () => {
      window.dispatchEvent(new CustomEvent("transactions:changed"));
    };

    const refreshWorker = () => {
      if (!role) return;

      if (workerTimer) clearTimeout(workerTimer);
      workerTimer = setTimeout(refreshWorkerNow, 300);
    };
    const refreshEmployer = (shiftId) => {
      if (!role) return;

      if (employerTimer) clearTimeout(employerTimer);
      employerTimer = setTimeout(() => refreshEmployerNow(shiftId), 300);
    };
    const refreshMine = (shiftId) =>
      role === "employer" ? refreshEmployer(shiftId) : refreshWorker();

    function handleStatusChanged(payload, status, defaultNoShow) {
      if (!role) return;

      dispatch(
        applicationStatusChanged({
          applicationId: payload.applicationId,
          status,
          shiftId: payload.shiftId,
          noShow: payload.noShow !== undefined ? payload.noShow : defaultNoShow,
          escrowAmount: payload.escrowAmount,
        }),
      );

      refreshMine(payload.shiftId);
    }

    const handlers = {
      "shift:accepted": (p) => {
        handleStatusChanged(p, "accepted");
        notifyTxChanged();
        toast.success(
          withIcon(
            PartyPopper,
            `Your application for "${p.shiftTitle}" was accepted!`,
          ),
        );
      },
      "shift:rejected": (p) => {
        handleStatusChanged(p, "rejected");
        toast(
          withIcon(
            Info,
            `Your application for "${p.shiftTitle}" was rejected.`,
          ),
        );
      },
      "shift:no_show_marked": (p) => {
        handleStatusChanged(p, "cancelled_by_worker", true);
        toast.error(
          withIcon(
            AlertTriangle,
            "You were marked as a no-show — that's a strike on your account.",
          ),
        );
      },
      "shift:employer_cancelled": (p) => {
        handleStatusChanged(p, "cancelled_by_employer");
        toast(
          withIcon(
            Info,
            `The employer cancelled your shift${p.shiftTitle ? ` "${p.shiftTitle}"` : ""}.`,
          ),
        );
      },
      "shift:cancelled_by_employer": (p) => {
        if (p.applicationId) handleStatusChanged(p, "cancelled_by_employer");
        else refreshWorker();
        notifyTxChanged();
        toast(
          withIcon(
            Info,
            p.penaltyPaidToYou > 0
              ? `The employer cancelled your shift late — you received ${inr(p.penaltyPaidToYou)} as compensation.`
              : "The employer cancelled your shift.",
          ),
        );
      },
      "shift:updated": (p) => {
        refreshMine(p?.shiftId);
      },
      "shift:cancelled_by_admin": (p) => {
        refreshMine(p?.shiftId);
        notifyTxChanged();
        toast(
          withIcon(
            ShieldAlert,
            role === "employer"
              ? "Your shift was cancelled by an administrator."
              : p.note ||
                  "A shift you were on was cancelled by an administrator.",
          ),
          { id: "admin-cancel-" + p?.shiftId }, //dedupe multiple tabs
        );
      },
      "shifts:changed": (p) => {
        window.dispatchEvent(new CustomEvent("shifts:changed", { detail: p }));
      },
      "workers:changed": () => {
        window.dispatchEvent(new CustomEvent("workers:changed"));
      },

     "shift:expired": (p) => {
  refreshMine(p.shiftId);
  notifyTxChanged();

  if (role === "worker") {
    toast(
      withIcon(
        Hourglass,
        p.penaltyPaidToYou > 0
          ? `A shift expired — you received ${inr(p.penaltyPaidToYou)} as compensation.`
          : "A shift expired because it was never started.",
      ),
    );
  } else if (role === "employer") {
    toast(
      withIcon(
        Hourglass,
        p.penaltyPaidToYou > 0
          ? `A shift expired — ${inr(p.penaltyPaidToYou)} penalty paid to the arrived worker; remaining escrow refunded to your wallet.`
          : "A shift expired — any locked escrow has been refunded to your wallet.",
      ),
    );
  }
},

      "shift:clocked_in": (p) => {
        refreshMine(p?.shiftId);
        if (role === "worker") {
          toast.success(
            withIcon(CheckCircle2, "You're clocked in. Have a great shift!"),
          );
        } else {
          toast.success(
            withIcon(
              CheckCircle2,
              "A worker clocked in — the shift has started.",
            ),
          );
        }
      },
      "shift:clocked_out": (p) => {
        refreshMine(p?.shiftId);
        notifyTxChanged();
        if (role === "worker") {
          toast.success(
            withIcon(
              Wallet,
              `Shift complete — ${inr(p.amountEarned)} added to your wallet`,
            ),
          );
        } else {
          toast.success(
            withIcon(
              Wallet,
              `A worker clocked out — awaiting your confirmation. Proposed pay ${inr(p.amountEarned)}.`,
            ),
          );
        }
      },
      "shift:force_clocked_out": (p) => {
        refreshMine(p?.shiftId);
        if (role === "worker") {
          toast(
            withIcon(
              AlertTriangle,
              `Your employer ended your shift early (proposed pay ${inr(p.proposedAmountEarned)}). ${p.note || ""}`.trim(),
            ),
            { duration: 8000 },
          );
        } else {
          toast.success(
            withIcon(CheckCircle2, "Shift ended early — worker notified."),
          );
        }
      },
      "shift:force_clockout_finalized": (p) => {
        refreshMine(p?.shiftId);
        notifyTxChanged();
        if (role === "worker") {
          toast.success(
            withIcon(
              Wallet,
              `Your dispute window closed — ${inr(p.amountEarned)} was paid out.`,
            ),
          );
        } else {
          toast.success(
            withIcon(
              CheckCircle2,
              "Shift finalized — payment released to the worker.",
            ),
          );
        }
      },
      "shift:auto_closed": (p) => {
        refreshMine(p?.shiftId);
        notifyTxChanged();
        if (role === "worker") {
          toast(
            withIcon(
              Timer,
              `Your shift was closed automatically — ${inr(p.amountEarned)} was paid out.`,
            ),
          );
        } else {
          toast(
            withIcon(
              Timer,
              `A shift was auto-closed — ${inr(p.amountEarned)} paid to the worker.`,
            ),
          );
        }
      },

      "application:new": (p) => {
        toast(
          withIcon(
            Inbox,
            `New application from ${p.workerName} for "${p.shiftTitle}"`,
          ),
        );
        refreshEmployer(p.shiftId);
      },
      "shift:worker_arrived": (p) => {
        dispatch(workerArrived(p));
        toast.success(withIcon(MapPin, "A worker has arrived on site."));
      },
      "shift:worker_cancelled": (p) => {
        refreshEmployer(p.shiftId);
        notifyTxChanged();
        if (p.noShow) {
          toast(
            withIcon(
              AlertTriangle,
              "Worker marked as no-show. Your escrow was refunded and the spot is open again.",
            ),
          );
        } else {
          toast(
            withIcon(
              Info,
              p.freeCancellation
                ? "A worker cancelled with plenty of notice. Your escrow was refunded and the spot is open again."
                : "A worker cancelled their shift. Your escrow was refunded and the spot is open again.",
            ),
          );
        }
      },
      "application:withdrawn": (p) => {
        // refreshEmployer already refetches stats + conditional applicants
        // (it fires fetchEmployerStats, fetchMyShifts, fetchWalletSummary,
        // and fetchApplicants only if the drawer is open).
        refreshEmployer(p.shiftId);
        toast(
          withIcon(
            Info,
            `${p.workerName} withdrew their application for "${p.shiftTitle}".`,
          ),
        );
      },
      "shift:worker_removed": (p) => {
        refreshEmployer(p.shiftId);
        notifyTxChanged();
        toast(
          withIcon(
            ShieldAlert,
            "A worker was removed from your shift by the platform. Your escrow was refunded.",
          ),
        );
      },

      "dispute:raised": (p) => {
        refreshMine(p.shiftId);
        dispatch(fetchMyDisputes());
        toast.error(
          withIcon(
            AlertTriangle,
            `A worker disputed an exit time. Upload proof by ${new Date(p.proofDeadline).toLocaleString()} or they'll be paid in full.`,
          ),
          { duration: 9000 },
        );
      },
      "dispute:evidence_submitted": (p) => {
        dispatch(fetchDispute(p.disputeId));
        dispatch(fetchMyApplications());
        toast(
          withIcon(
            Search,
            "Your employer submitted proof — an admin is reviewing the dispute.",
          ),
        );
      },
      "dispute:resolved": (p) => {
        dispatch(fetchDispute(p.disputeId));
        dispatch(fetchMyDisputes());
        refreshMine();
        notifyTxChanged();
        const mine =
          (role === "worker" && p.ruledFor === "worker") ||
          (role === "employer" && p.ruledFor === "employer");
        const who = p.autoResolved ? "automatically" : "by an admin";
        const fn = mine ? toast.success : toast;
        fn(
          withIcon(
            mine ? CheckCircle2 : Info,
            `Dispute resolved ${who} in ${mine ? "your" : "the other party's"} favour.`,
          ),
          { duration: 7000 },
        );
      },
      "user:verified": (p) => {
        dispatch(fetchMe());
        dispatch(fetchProfile());
        dispatch(fetchWalletSummary());

        if (p.verificationStatus === "verified") {
          toast.success(
            withIcon(CheckCircle2, "Your account has been verified!"),
            { duration: 6000 },
          );
        } else if (p.verificationStatus === "rejected") {
          toast.error(
            withIcon(
              AlertTriangle,
              "Your verification was rejected. Please check your profile for details.",
            ),
            { duration: 6000 },
          );
        }
      },

      "user:updated": (p) => {
        dispatch(fetchMe());
        dispatch(fetchWalletSummary());
        if (p?.strikes === 0) {
          toast.success(
            withIcon(CheckCircle2, "Your strikes were reset by an admin."),
            { duration: 5000 },
          );
        }
      },

      "review:new": (p) => {
        toast.success(
          withIcon(
            Star,
            `${p.reviewerName} left you a ${p.rating}-star review for "${p.shiftTitle}"!`,
          ),
        );
        dispatch(fetchMyReviews());
      },

      "admin:queue_changed": (p) => {
        window.dispatchEvent(
          new CustomEvent("admin:queue_changed", { detail: p }),
        );
      },

      // Server emits one of these reasons on `wallet:updated`:
      //   topup           - top-up succeeded
      //   topup_failed    - payment.failed at Razorpay
      //   payout_success  - payout.processed
      //   payout_rejected - payout.rejected (approval workflow)
      //   payout_failed   - payout.failed (bank/NPCI down)
      //   payout_reversed - payout.reversed (bank returned funds)
      // The `id` field dedupes against the thunk's own success toast.
      "wallet:updated": (p) => {
        dispatch(fetchWalletSummary());
        notifyTxChanged();
        const rupees =
          typeof p?.amount === "number" ? p.amount.toFixed(2) : null;

        if (p?.reason === "topup" && rupees) {
          toast.success(withIcon(Wallet, `₹${rupees} added to your wallet!`), {
            id: "wallet-topup-success",
          });
        } else if (p?.reason === "payout_success" && rupees) {
          toast.success(
            withIcon(CheckCircle2, `₹${rupees} reached your bank!`),
            { id: "wallet-update", duration: 5000 },
          );
        } else if (p?.reason === "payout_rejected" && rupees) {
          toast(
            withIcon(
              Info,
              `Payout rejected by approver — ₹${rupees} refunded to your wallet`,
            ),
            { id: "wallet-update", duration: 7000 },
          );
        } else if (p?.reason === "payout_failed" && rupees) {
          toast.error(
            withIcon(
              AlertTriangle,
              `Payout failed due to a bank issue — ₹${rupees} refunded to your wallet`,
            ),
            { id: "wallet-update", duration: 8000 },
          );
        } else if (p?.reason === "payout_reversed" && rupees) {
          toast(
            withIcon(
              Info,
              `Bank reversed a payout — ₹${rupees} refunded to your wallet`,
            ),
            { id: "wallet-update", duration: 7000 },
          );
        } else if (p?.reason === "topup_failed") {
          toast.error(
            withIcon(AlertTriangle, "Payment failed — no money was charged"),
            { id: "wallet-topup-failed", duration: 6000 },
          );
        }
        // No toast for unknown reasons (future-proof) — balance still
        // refreshes via fetchWalletSummary above, so data stays correct.
      },
    };

    let skipNext = !socket.connected;
    const onConnect = () => {
      if (skipNext) {
        skipNext = false;
        return;
      }
      if (role) {
        dispatch(fetchMe());
        if (role === "employer") refreshEmployerNow();
        else if (role === "worker") refreshWorkerNow();
      }
      window.dispatchEvent(new CustomEvent("shifts:changed", { detail: {} }));
    };
    socket.on("connect", onConnect);
    const publicEvents = ["shifts:changed"];
    Object.entries(handlers).forEach(([event, fn]) => {
      if (role || publicEvents.includes(event)) {
        socket.on(event, fn);
      }
    });
    return () => {
      if (workerTimer) clearTimeout(workerTimer);
      if (employerTimer) clearTimeout(employerTimer);

      Object.entries(handlers).forEach(([event, fn]) => {
        if (role || publicEvents.includes(event)) {
          socket.off(event, fn);
        }
      });
      socket.off("connect", onConnect);
    };
  }, [dispatch, authChecked, role]);
}
