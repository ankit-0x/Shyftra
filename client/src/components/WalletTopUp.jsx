// client/src/components/WalletTopUp.jsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { topUpWallet } from "../store/walletSlice";
import toast from "react-hot-toast";
import { Wallet, IndianRupee, PlusCircle, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

function WalletTopUp() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isVerified = user?.verificationStatus === "verified";

  async function handleTopUp(valToUse) {
    if (!isVerified) return;
    const value = parseFloat(valToUse ?? amount);
    
    if (!value || value <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      await dispatch(topUpWallet(value)).unwrap(); 
      setAmount(""); 
      
     
    } catch (error) {
      console.log("Top-up failed or cancelled:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`bg-base-100 rounded-2xl border border-base-200 shadow-sm p-4 sm:p-5 flex flex-col h-full ${!isVerified ? "opacity-80" : ""}`}>
      <h3 className="font-extrabold text-base text-base-content tracking-tight flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-primary" /> Add Money to Wallet
      </h3>

      {/* Quick Amount Chips */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {QUICK_AMOUNTS.map((val) => (
          <button
            key={val}
            type="button"
            disabled={isLoading || !isVerified}
            onClick={() => {
              setAmount(val);
              handleTopUp(val);
            }}
            className="btn btn-xs bg-base-200/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border-base-200 text-xs font-bold rounded-lg py-1.5"
          >
            +₹{val}
          </button>
        ))}
      </div>

      {/* Custom Amount Input & Submit */}
      <div className="flex gap-2 relative mb-3">
        <div className="relative flex-1">
          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom amount"
            className="input input-sm input-bordered w-full pl-7 rounded-xl text-xs focus:outline-primary/20 focus:border-primary font-medium"
            disabled={isLoading || !isVerified}
          />
        </div>
        <button 
          type="button"
          className="btn btn-sm btn-primary rounded-xl shrink-0 px-4 font-bold gap-1" 
          onClick={() => handleTopUp()}
          disabled={isLoading || !amount || !isVerified}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
          Add
        </button>
      </div>

      {/* Verification Warning (Chhota sa message) */}
      {!isVerified && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-warning mb-2 bg-warning/10 p-2 rounded-lg">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Verify your account to top up.</span>
        </div>
      )}

      {/* Professional Payment Security Footer */}
      <div className="mt-auto pt-3 border-t border-base-200/60 bg-base-200/30 -mx-4 -mb-4 p-3.5 rounded-b-2xl space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-base-content/70">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" />
          <span>Secure Payments</span>
        </div>
        <p className="text-[11px] text-base-content/50 leading-relaxed">
          All transactions are encrypted and processed securely via trusted payment gateways.
        </p>
      </div>
    </div>
  );
}

export default WalletTopUp;