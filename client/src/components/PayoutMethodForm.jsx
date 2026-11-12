// client/src/components/PayoutMethodForm.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ShieldAlert, Landmark, IndianRupee, Send, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { addPayoutMethod, requestPayout, fetchPayoutMethod } from "../store/walletSlice";
import PayoutVerifyModal from "./PayoutVerifyModal";
import { MIN_WITHDRAWAL, MAX_WITHDRAWAL } from "../constants/businessRule";

function PayoutMethodForm() {
  const dispatch = useDispatch();
  const summary = useSelector((state) => state.wallet.summary);
  const payoutMethod = useSelector((state) => state.wallet.payoutMethod);
  const { user } = useSelector((state) => state.auth);
  const [type, setType] = useState("vpa");
  const [vpa, setVpa] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [verify, setVerify] = useState(null);

  const isVerified = user?.verificationStatus === "verified";

  useEffect(() => {
    if (isVerified) dispatch(fetchPayoutMethod());
  }, [dispatch, user?.id, isVerified]);

  const cooldownUntil = payoutMethod?.cooldownUntil ? new Date(payoutMethod.cooldownUntil) : null;
  const inCooldown = !!cooldownUntil && cooldownUntil > new Date();

  function handleSave() {
    if (!isVerified) return;
    if (type === "vpa" && !vpa.trim()) return toast.error("Enter your UPI ID");
    if (type === "bank_account" && (!accountNumber.trim() || !ifsc.trim())) return toast.error("Enter account number and IFSC");
    const payload = type === "vpa" ? { type, vpa: vpa.trim() } : { type, accountNumber: accountNumber.trim(), ifsc: ifsc.trim() };
    setVerify({ mode: "save", payload });
  }

  function handleCashOut() {
    if (!isVerified) return;
    const value = parseFloat(cashOutAmount);
    if (!value || value <= 0) return;
    if (value < MIN_WITHDRAWAL || value > MAX_WITHDRAWAL) {
      toast.error(`Withdrawals must be between ₹${MIN_WITHDRAWAL} and ₹${MAX_WITHDRAWAL.toLocaleString("en-IN")}`);
      return;
    }
    if (summary && value > summary.withdrawable) {
      toast.error(`Only ₹${summary.withdrawable} can be withdrawn right now.`);
      return;
    }
    if (!payoutMethod?.hasMethod) return toast.error("Save a payout method first");
    if (inCooldown) return toast.error("Your new payout method is still in its 24-hour safety period");
    setVerify({ mode: "cashout", amount: value });
  }

  async function handleVerified(creds) {
    if (verify.mode === "save") {
      await dispatch(addPayoutMethod({ ...verify.payload, ...creds })).unwrap();
      setVpa(""); setAccountNumber(""); setIfsc("");
    } else {
      await dispatch(requestPayout({ amount: verify.amount, otp: creds.otp })).unwrap();
      setCashOutAmount("");
    }
  }

  return (
    <div className={`bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 sm:p-5 flex flex-col h-full ${!isVerified ? "opacity-80" : ""}`}>
      <h3 className="font-extrabold text-base text-base-content tracking-tight flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-primary" /> Payout Settings
      </h3>

      {payoutMethod?.hasMethod && (
        <div className="mb-3 rounded-xl border border-base-200 bg-base-200/40 p-2.5 text-[11px]">
          <p className="font-bold text-base-content">Saved: {payoutMethod.label || "Payout method on file"}</p>
          {inCooldown && (
            <p className="mt-1 flex items-start gap-1 text-warning font-medium">
              <Clock className="w-3 h-3 mt-0.5 shrink-0" />
              Withdrawals unlock {cooldownUntil.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} (24-hour safety period).
            </p>
          )}
        </div>
      )}

      {/* Segmented Control for Payout Type */}
      <div className="flex bg-base-200/50 p-1 rounded-xl mb-3">
        <button
          disabled={!isVerified}
          className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
            type === "vpa" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/60 hover:text-base-content"
          }`}
          onClick={() => setType("vpa")}
        >
          UPI ID
        </button>
        <button
          disabled={!isVerified}
          className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all ${
            type === "bank_account" ? "bg-base-100 shadow-sm text-primary" : "text-base-content/60 hover:text-base-content"
          }`}
          onClick={() => setType("bank_account")}
        >
          Bank Transfer
        </button>
      </div>

      {/* Dynamic Input Fields */}
      <div className="space-y-2 mb-3">
        {type === "vpa" ? (
          <input
            value={vpa}
            onChange={(e) => setVpa(e.target.value)}
            placeholder="yourname@upi"
            disabled={!isVerified}
            className="input input-sm input-bordered w-full rounded-lg text-xs focus:outline-primary/20 focus:border-primary"
          />
        ) : (
          <div className="flex gap-2">
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number"
              disabled={!isVerified}
              className="input input-sm input-bordered w-2/3 rounded-lg text-xs focus:outline-primary/20 focus:border-primary"
            />
            <input
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value)}
              placeholder="IFSC"
              disabled={!isVerified}
              className="input input-sm input-bordered w-1/3 rounded-lg text-xs focus:outline-primary/20 focus:border-primary"
            />
          </div>
        )}
        <button 
          disabled={!isVerified}
          className="btn btn-sm btn-outline border-base-300 rounded-lg w-full text-xs font-bold" 
          onClick={handleSave}
        >
          Save Method
        </button>
      </div>

      {/* Cash Out Section (Pushed to bottom) */}
      <div className="mt-auto pt-3 border-t border-base-200 space-y-2.5">
        {summary && (
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-base-content/60">Withdrawable:</span>
            <span className="text-base-content font-bold flex items-center">
              <IndianRupee className="w-3 h-3" /> {summary.withdrawable}
              {summary.held > 0 && <span className="text-base-content/40 ml-1 font-normal">(₹{summary.held} held)</span>}
            </span>
          </div>
        )}
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
            <input
              type="number"
              value={cashOutAmount}
              onChange={(e) => setCashOutAmount(e.target.value)}
              placeholder="Amount"
              disabled={!isVerified}
              className="input input-sm input-bordered w-full pl-7 rounded-xl text-xs focus:outline-primary/20 focus:border-primary font-medium"
            />
          </div>
          <button 
            disabled={inCooldown || !isVerified} 
            className="btn btn-sm btn-primary rounded-xl shrink-0 px-4" 
            onClick={handleCashOut}
          >
            Cash Out <Send className="w-3 h-3 ml-1" />
          </button>
        </div>
      </div>

      {/* Verification Warning (Chhota sa message) */}
      {!isVerified && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-warning mt-3 bg-warning/10 p-2 rounded-lg">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Verify your account to use payouts.</span>
        </div>
      )}

      {verify && (
        <PayoutVerifyModal
          mode={verify.mode}
          amount={verify.amount}
          summaryText={verify.mode === "cashout" ? `Withdraw ₹${verify.amount} to ${payoutMethod?.label || "your saved payout method"}. We'll email you a 6-digit code.` : ""}
          onConfirm={handleVerified}
          onClose={() => setVerify(null)}
        />
      )}
    </div>
  );
}

export default PayoutMethodForm;