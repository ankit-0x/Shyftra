// client/src/components/admin/LedgerPanel.jsx
// Money-integrity checks: GET /api/admin/ledger (history) and
// POST /api/admin/ledger/run (run one now).
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLedgerChecks, runLedgerCheckNow } from "../../store/adminSlice";
import { 
  Wallet, 
  AlertCircle, 
  Play, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Layers
} from "lucide-react";

// The ledger report is returned raw (integer paise), unlike most endpoints.
const rupees = (paise) =>
  typeof paise === "number" ? `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

const TOTAL_LABELS = {
  walletTotal: "Wallets (total)",
  lockedEscrow: "Locked in escrow",
  platformBalance: "Platform wallet",
  topupsIn: "Top-ups in",
  withdrawalsOut: "Withdrawals out",
  heldTotal: "Held",
  expectedTotal: "Expected total",
  difference: "Difference",
};

export default function LedgerPanel() {
  const dispatch = useDispatch();
  const { ledgerChecks, isLoadingLedger, isRunningLedger } = useSelector((state) => state.admin);

  useEffect(() => {
    dispatch(fetchLedgerChecks());
  }, [dispatch]);

  const latest = ledgerChecks[0];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header & Trigger */}
      <div className="bg-base-100 rounded-2xl p-5 border border-base-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-base-content">Platform Ledger Integrity</h3>
            <p className="text-sm text-base-content/60">
              Compares every wallet, escrow hold, and transaction. A healthy ledger has a difference of ₹0.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm gap-2 shrink-0 shadow-sm shadow-primary/20"
          onClick={() => dispatch(runLedgerCheckNow())}
          disabled={isRunningLedger}
        >
          {isRunningLedger ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          Run check now
        </button>
      </div>

      {isLoadingLedger && !latest ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !latest ? (
        <div className="bg-base-100 rounded-2xl border border-base-200 p-12 text-center">
          <Clock className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
          <h3 className="font-bold text-lg">No checks recorded yet</h3>
          <p className="text-base-content/60 text-sm mt-1">Run your first ledger verification check above.</p>
        </div>
      ) : (
        <>
          {/* Latest Status Banner */}
          <div className={`rounded-2xl p-6 border shadow-sm ${latest.ok ? "bg-success/5 border-success/20" : "bg-error/5 border-error/20"}`}>
            <div className="flex justify-between items-center flex-wrap gap-2 pb-4 border-b border-base-content/10">
              <div className="flex items-center gap-2.5">
                {latest.ok ? (
                  <CheckCircle2 className="w-6 h-6 text-success" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-error" />
                )}
                <span className={`font-bold text-lg ${latest.ok ? "text-success" : "text-error"}`}>
                  {latest.ok ? "Ledger balanced successfully" : "Ledger mismatch detected"}
                </span>
              </div>
              <span className="text-xs font-medium text-base-content/50 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {new Date(latest.createdAt).toLocaleString()}
              </span>
            </div>

            {latest.issues?.length > 0 && (
              <div className="mt-4 bg-error/10 border border-error/20 p-4 rounded-xl">
                <p className="text-xs font-bold text-error uppercase tracking-wider mb-2">Identified Issues</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-error/90">
                  {latest.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {latest.totals && (
              <div className="mt-6">
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">Ledger Totals Breakdown</p>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(latest.totals).map(([key, value]) => (
                    <div key={key} className="bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm">
                      <dt className="text-xs text-base-content/60 font-medium capitalize mb-1">
                        {TOTAL_LABELS[key] || key}
                      </dt>
                      <dd className={`text-lg font-bold ${key === 'difference' && value !== 0 ? 'text-error' : 'text-base-content'}`}>
                        {rupees(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {/* History List */}
          <div className="bg-base-100 rounded-2xl p-6 border border-base-200 shadow-sm">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Check History (Last {ledgerChecks.length})
            </h3>
            <div className="space-y-2.5">
              {ledgerChecks.map((c) => (
                <div key={c._id} className="flex justify-between items-center p-3 rounded-xl bg-base-200/40 border border-base-200/60 text-sm">
                  <div className="flex items-center gap-2.5">
                    {c.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-error shrink-0" />
                    )}
                    <span className={`font-semibold ${c.ok ? "text-success" : "text-error"}`}>
                      {c.ok ? "Balanced" : `${c.issues?.length || 0} issue(s) found`}
                    </span>
                  </div>
                  <span className="text-xs text-base-content/50">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}