// client/src/pages/TransactionHistory.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { fetchTransactions } from "../store/transactionSlice";
import { useLiveTick } from "../hooks/useLiveTick";
import TransactionDetailModal from "../components/TransactionDetailModal";

const TYPE_META = {
  // Credits
  topup: { label: "Wallet Top-up" },
  escrow_release: { label: "Shift Earnings" },
  escrow_refund: { label: "Escrow Refund" },
  cancellation_penalty: { label: "Late Cancellation Compensation" },
  dispute_payout: { label: "Dispute Payout" },
  payout_reversal: { label: "Payout Reversal" },
  admin_manual_refund: { label: "Admin Refund" },
  // Debits
  withdrawal: { label: "Withdrawal to Bank" },
  platform_fee: { label: "Platform Fee" },
  escrow_lock: { label: "Escrow Lock" },
  admin_forfeit: { label: "Admin Forfeit" },
};

const STATUS_META = {
  pending: { label: "Pending", icon: Clock, className: "badge-warning" },
  processing: { label: "Processing", icon: Clock, className: "badge-info" },
  success: { label: "Success", icon: CheckCircle2, className: "badge-success" },
  failed: { label: "Failed", icon: XCircle, className: "badge-error" },
  reversed: { label: "Reversed", icon: RotateCcw, className: "badge-warning" },
};

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function TransactionHistory() {
  const dispatch = useDispatch();
    const { list, page, hasMore, total, totals, status, error } = useSelector(
    (s) => s.transactions,
  );
  const [direction, setDirection] = useState("all");
  const [openTxId, setOpenTxId] = useState(null);
  const tick = useLiveTick("transactions:changed");

  useEffect(() => {
    dispatch(
      fetchTransactions({
        page: 1,
        limit: 20,
        direction: direction === "all" ? undefined : direction,
      }),
    );
  }, [dispatch, direction, tick]);

  function loadMore() {
    dispatch(
      fetchTransactions({
        page: page + 1,
        limit: 20,
        direction: direction === "all" ? undefined : direction,
        append: true,
      }),
    );
  }

  const isLoading = status === "loading";
  const isFirstLoad = isLoading && list.length === 0;

    // True totals from backend — sum of ALL transactions in DB for this user,
  // independent of pagination. Fresh on every fetch.
  const totalIn = totals?.credit?.total ?? 0;
  const totalOut = totals?.debit?.total ?? 0;

  if (user && !["employer", "worker"].includes(user.role)) {
  return <Navigate to="/dashboard" replace />;
}

  return (
    <div className="min-h-screen bg-base-200/50 px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8 lg:py-8">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-primary/10 rounded-2xl shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-base-content truncate">
              Transaction History
            </h1>
                       <p className="text-xs sm:text-sm text-base-content/60 truncate">
              {total > 0
                ? `${list.length} of ${total} shown`
                : "All your wallet activity"}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch(
                fetchTransactions({
                  page: 1,
                  limit: 20,
                  direction: direction === "all" ? undefined : direction,
                }),
              )
            }
            className="btn btn-sm btn-ghost btn-circle shrink-0"
            aria-label="Refresh transactions"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

                {/* Summary — TRUE full-history totals (not just loaded list) */}
        {list.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-base-100 rounded-2xl border border-success/20 p-3 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success shrink-0" />
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-base-content/60 truncate">
                    Credits (total)
                  </p>
                </div>
                <p className="text-base sm:text-xl font-bold text-success truncate">
                  {formatMoney(totalIn)}
                </p>
                {totals?.credit?.count > 0 && (
                  <p className="text-[10px] sm:text-xs text-base-content/50 mt-0.5">
                    {totals.credit.count} transaction
                    {totals.credit.count !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div className="bg-base-100 rounded-2xl border border-error/20 p-3 sm:p-4 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-error shrink-0" />
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-base-content/60 truncate">
                    Debits (total)
                  </p>
                </div>
                <p className="text-base sm:text-xl font-bold text-error truncate">
                  {formatMoney(totalOut)}
                </p>
                {totals?.debit?.count > 0 && (
                  <p className="text-[10px] sm:text-xs text-base-content/50 mt-0.5">
                    {totals.debit.count} transaction
                    {totals.debit.count !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* "Showing X of Y" hint when there are more to load */}
            {hasMore && (
              <p className="text-xs text-base-content/50 text-center px-1">
                Showing <strong className="text-base-content">{list.length}</strong> of{" "}
                <strong className="text-base-content">{total}</strong> loaded — click
                "Load More" below
              </p>
            )}
          </div>
        )}

        {/* Filter */}
        <div className="bg-base-100 p-1 rounded-xl flex sm:inline-flex w-full sm:w-auto shadow-sm border border-base-200">
          {[
            { key: "all", label: "All" },
            { key: "credit", label: "Money In" },
            { key: "debit", label: "Money Out" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDirection(tab.key)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                direction === tab.key
                  ? "bg-base-200 text-base-content font-bold shadow-sm"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isFirstLoad && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !isFirstLoad && (
          <div className="bg-error/10 border border-error/20 rounded-2xl p-3 sm:p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error wrap-break-word">{error}</p>
          </div>
        )}

        {!isFirstLoad && !error && list.length === 0 && (
          <div className="bg-base-100 rounded-2xl border border-base-200 p-8 sm:p-12 text-center">
            <Wallet className="w-10 h-10 sm:w-12 sm:h-12 text-base-content/20 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-bold text-base-content">
              No transactions yet
            </h3>
            <p className="text-xs sm:text-sm text-base-content/60 mt-1">
              {direction === "credit"
                ? "No incoming transactions yet."
                : direction === "debit"
                  ? "No outgoing transactions yet."
                  : "Your wallet activity will show up here."}
            </p>
          </div>
        )}

        {list.length > 0 && (
          <div className="space-y-2">
            {list.map((tx) => {
              const meta = TYPE_META[tx.type] || { label: tx.type };
              const statusMeta = STATUS_META[tx.status] || {
                label: tx.status,
                icon: Clock,
                className: "badge-ghost",
              };
              const StatusIcon = statusMeta.icon;
              const isCredit = tx.direction === "credit";

              return (
                <div
                  key={tx._id}
                  onClick={() => setOpenTxId(tx._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenTxId(tx._id);
                    }
                  }}
                  className="bg-base-100 rounded-2xl border border-base-200 p-3 sm:p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? "bg-success/10 text-success"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-base-content truncate">
                            {meta.label}
                          </p>
                          {tx.shift?.title && (
                            <p className="text-xs text-base-content/60 truncate mt-0.5">
                              {tx.shift.title}
                            </p>
                          )}
                          <p className="text-[11px] sm:text-xs text-base-content/50 mt-0.5">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`font-bold text-sm whitespace-nowrap ${
                              isCredit ? "text-success" : "text-error"
                            }`}
                          >
                            {isCredit ? "+" : "−"}
                            {formatMoney(tx.amount)}
                          </p>
                          {typeof tx.balanceAfter === "number" && (
                            <p className="text-[10px] sm:text-[11px] text-base-content/50 mt-0.5 whitespace-nowrap">
                              Bal: {formatMoney(tx.balanceAfter)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                        <span
                          className={`badge badge-sm font-medium gap-1 ${statusMeta.className}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusMeta.label}
                        </span>
                        {tx.failureReason && (
                          <span className="text-[10px] sm:text-[11px] text-error italic truncate max-w-[60%]">
                            {tx.failureReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

                {hasMore && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={isLoading}
              className="btn btn-sm btn-outline rounded-xl gap-2 w-full sm:w-auto sm:min-w-44"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading
                ? "Loading..."
                : `Load More (${total - list.length} remaining)`}
            </button>
          </div>
        )}

        {/* All-loaded indicator */}
        {!hasMore && list.length > 0 && (
          <p className="text-xs text-base-content/50 text-center py-2">
            All {total} transaction{total !== 1 ? "s" : ""} loaded
          </p>
        )}

        <TransactionDetailModal
          txId={openTxId}
          onClose={() => setOpenTxId(null)}
        />
      </div>
    </div>
  );
}
