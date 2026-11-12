// client/src/components/TransactionDetailModal.jsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ArrowDownLeft, ArrowUpRight, Loader2, AlertCircle,
  CheckCircle2, Clock, XCircle, RotateCcw, Wallet, Building2,
  ArrowRight, Banknote, ShieldCheck,
} from "lucide-react";
import api from "../api/axios";

const TYPE_LABEL = {
  topup: "Wallet Top-up",
  escrow_release: "Shift Earnings",
  escrow_refund: "Escrow Refund",
  cancellation_penalty: "Late Cancellation Compensation",
  dispute_payout: "Dispute Payout",
  payout_reversal: "Payout Reversal",
  admin_manual_refund: "Admin Refund",
  withdrawal: "Withdrawal to Bank",
  platform_fee: "Platform Fee",
  escrow_lock: "Escrow Lock",
  admin_forfeit: "Admin Forfeit",
};

const STATUS_META = {
  pending:    { label: "Pending",    icon: Clock,        className: "badge-warning" },
  processing: { label: "Processing", icon: Clock,        className: "badge-info" },
  success:    { label: "Success",    icon: CheckCircle2, className: "badge-success" },
  failed:     { label: "Failed",     icon: XCircle,      className: "badge-error" },
  reversed:   { label: "Reversed",   icon: RotateCcw,    className: "badge-warning" },
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const formatMoney = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function getParties(tx) {
  const employer = tx.shift?.employer?.businessName || "Employer";
  const worker = tx.application?.worker?.name || "Worker";
  const isCredit = tx.direction === "credit";

  switch (tx.type) {
    case "topup":
      return { from: "Razorpay Payment", to: "Your Wallet", fromIcon: Banknote, toIcon: Wallet };
    case "withdrawal":
      return { from: "Your Wallet", to: "Your Payout Method", fromIcon: Wallet, toIcon: Banknote };
    case "escrow_lock":
      return { from: "Your Wallet", to: `Escrow for ${worker}`, fromIcon: Wallet, toIcon: ShieldCheck };
    case "escrow_release":
      return { from: `Escrow (${employer})`, to: "Your Wallet", fromIcon: ShieldCheck, toIcon: Wallet };
    case "escrow_refund":
      return { from: "Escrow", to: "Your Wallet", fromIcon: ShieldCheck, toIcon: Wallet };
    case "platform_fee":
      return { from: "Your Wallet", to: "Shyftra Platform", fromIcon: Wallet, toIcon: Building2 };
    case "cancellation_penalty":
      return { from: employer, to: "Your Wallet", fromIcon: Building2, toIcon: Wallet };
    case "dispute_payout":
      return { from: "Escrow (Dispute)", to: "Your Wallet", fromIcon: ShieldCheck, toIcon: Wallet };
    case "payout_reversal":
      return { from: "Bank (Reversed)", to: "Your Wallet", fromIcon: Banknote, toIcon: Wallet };
    case "admin_forfeit":
      return { from: "Your Wallet", to: "Shyftra Platform", fromIcon: Wallet, toIcon: Building2 };
    case "admin_manual_refund":
      return { from: "Shyftra Platform", to: "Your Wallet", fromIcon: Building2, toIcon: Wallet };
    default:
      return isCredit
        ? { from: "External", to: "Your Wallet", fromIcon: Banknote, toIcon: Wallet }
        : { from: "Your Wallet", to: "External", fromIcon: Wallet, toIcon: Banknote };
  }
}

function Row({ label, value, mono = false }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-base-200/60 last:border-0">
      <dt className="text-[11px] font-medium text-base-content/55 shrink-0">
        {label}
      </dt>
      <dd
        className={`text-[11px] text-right text-base-content min-w-0 ${
          mono ? "font-mono break-all" : "font-semibold wrap-break-word"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function TransactionDetailModal({ txId, onClose }) {
  const [tx, setTx] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!txId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTx(null);

    api
      .get(`/api/transactions/${txId}`)
      .then((r) => !cancelled && setTx(r.data))
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.error || "Failed to load transaction");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [txId]);

  useEffect(() => {
    if (!txId) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [txId, onClose]);

  return (
    <AnimatePresence>
      {txId && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle z-100"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="modal-box w-full sm:max-w-md bg-base-100 p-3.5 sm:p-5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-5 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-xs btn-circle btn-ghost absolute right-1.5 top-1.5 z-10"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-7 h-7 animate-spin text-primary mb-2" />
                <p className="text-xs text-base-content/60">Loading details…</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 bg-error/10 border border-error/20 p-2.5 rounded-xl mt-5">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error wrap-break-word">{error}</p>
              </div>
            )}

            {tx && !loading && (() => {
              const meta = STATUS_META[tx.status] || {
                label: tx.status, icon: Clock, className: "badge-ghost",
              };
              const StatusIcon = meta.icon;
              const isCredit = tx.direction === "credit";
              const parties = getParties(tx);
              const FromIcon = parties.fromIcon;
              const ToIcon = parties.toIcon;

              const balanceBefore =
                typeof tx.balanceAfter === "number"
                  ? isCredit
                    ? tx.balanceAfter - tx.amount
                    : tx.balanceAfter + tx.amount
                  : null;

              return (
                <div className="space-y-2.5 sm:space-y-3">
                  {/* ── Header ── */}
                  <div className="text-center">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center mx-auto mb-1.5 ${
                      isCredit ? "bg-success/10 text-success" : "bg-error/10 text-error"
                    }`}>
                      {isCredit
                        ? <ArrowDownLeft className="w-5 h-5" />
                        : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider px-6 truncate">
                      {TYPE_LABEL[tx.type] || tx.type}
                    </p>
                    <p className={`text-[22px] sm:text-2xl font-black mt-0.5 break-all ${isCredit ? "text-success" : "text-error"}`}>
                      {isCredit ? "+" : "−"}{formatMoney(tx.amount)}
                    </p>
                    <div className="mt-1.5">
                      <span className={`badge badge-sm font-medium gap-1 ${meta.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>
                    {tx.failureReason && (
                      <p className="text-[11px] text-error mt-1.5 italic wrap-break-word px-2">
                        {tx.failureReason}
                      </p>
                    )}
                  </div>

                  {/* ── Combined Card: From/To + Balance ── */}
                  <div className="bg-base-200/40 rounded-xl overflow-hidden">
                    {/* From → To */}
                    <div className="p-2.5 sm:p-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <FromIcon className="w-3 h-3 text-base-content/40 shrink-0" />
                          <span className="text-[9px] uppercase font-bold text-base-content/50">
                            From
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-base-content truncate" title={parties.from}>
                          {parties.from}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-base-content/30 shrink-0" />
                      <div className="min-w-0 text-right">
                        <div className="flex items-center gap-1 mb-0.5 justify-end">
                          <span className="text-[9px] uppercase font-bold text-base-content/50">
                            To
                          </span>
                          <ToIcon className="w-3 h-3 text-base-content/40 shrink-0" />
                        </div>
                        <p className="text-xs font-semibold text-base-content truncate" title={parties.to}>
                          {parties.to}
                        </p>
                      </div>
                    </div>

                    {/* Balance Impact — single row */}
                    {balanceBefore != null && typeof tx.balanceAfter === "number" && (
                      <div className="border-t border-base-200/60 p-2.5 sm:p-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-base-content/50 mb-0.5">Before</p>
                          <p className="text-xs font-semibold text-base-content whitespace-nowrap truncate">
                            {formatMoney(balanceBefore)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-base-content/50 mb-0.5">Change</p>
                          <p className={`text-xs font-semibold whitespace-nowrap truncate ${isCredit ? "text-success" : "text-error"}`}>
                            {isCredit ? "+" : "−"}{formatMoney(tx.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-base-content/50 mb-0.5">After</p>
                          <p className="text-xs font-bold text-base-content whitespace-nowrap truncate">
                            {formatMoney(tx.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Details ── */}
                  <div>
                    <p className="text-[9px] font-bold text-base-content/50 uppercase tracking-wider mb-0.5 px-0.5">
                      Details
                    </p>
                    <dl>
                      <Row label="Date" value={formatDate(tx.createdAt)} />
                      {tx.shift?.title && <Row label="Shift" value={tx.shift.title} />}
                      {tx.shift?.address && <Row label="Location" value={tx.shift.address} />}
                      {tx.shift?.startTime && (
                        <Row
                          label="Shift Time"
                          value={`${formatDate(tx.shift.startTime)} → ${formatDate(tx.shift.endTime)}`}
                        />
                      )}
                      {tx.razorpayOrderId && <Row label="Order ID" value={tx.razorpayOrderId} mono />}
                      {tx.razorpayPaymentId && <Row label="Payment ID" value={tx.razorpayPaymentId} mono />}
                      {tx.razorpayPayoutId && <Row label="Payout ID" value={tx.razorpayPayoutId} mono />}
                      <Row label="Txn ID" value={String(tx._id).slice(-12)} mono />
                    </dl>
                  </div>

                  {/* ── Footer ── */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-primary btn-sm w-full rounded-xl font-bold"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}