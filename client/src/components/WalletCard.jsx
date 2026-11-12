// client/src/components/WalletCard.jsx
// Live wallet numbers from GET /api/wallet/summary:
//   balance      – everything in the wallet
//   held         – recent top-ups / earnings still inside their hold window
//   withdrawable – what a payout can actually take right now
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWalletSummary } from "../store/walletSlice";
import { Wallet, ArrowUpRight, Clock, Loader2 } from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function WalletCard({ className = "" }) {
  const dispatch = useDispatch();
  const { summary, status } = useSelector((state) => state.wallet);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (user) dispatch(fetchWalletSummary());
  }, [dispatch, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`bg-base-100 rounded-2xl border border-base-200 p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase font-extrabold tracking-wider text-base-content/50">Wallet Balance</p>
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        
        <p className="text-2xl sm:text-3xl font-black text-base-content tracking-tight mt-1">
          {status === "loading" && !summary ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </span>
          ) : (
            inr(summary?.balance ?? user?.walletBalance)
          )}
        </p>
      </div>

      {summary && (
        <div className="mt-4 pt-3 border-t border-base-200 grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-base-content/50 text-[11px] font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-success" /> Withdrawable
            </p>
            <p className="font-extrabold text-sm text-base-content">{inr(summary.withdrawable)}</p>
          </div>
          <div 
            className="space-y-0.5" 
            title="Recent top-ups and earnings are held for a short period before they can be withdrawn."
          >
            <p className="text-base-content/50 text-[11px] font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-warning" /> On Hold
            </p>
            <p className="font-extrabold text-sm text-base-content">{inr(summary.held)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletCard;