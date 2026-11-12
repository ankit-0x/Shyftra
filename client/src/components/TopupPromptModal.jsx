import { Link } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet, ArrowRight, CheckCircle2 } from "lucide-react";

const VARIANTS = {
    post_shift: {
    cost: (amount, balance) => (
      <>
        Posting a shift costs{" "}
        <strong className="text-base-content">₹{amount}</strong>. Your current
        balance is{" "}
        <strong className="text-base-content">
          ₹{balance.toFixed(2)}
        </strong>
        .
      </>
    ),
    savedLead: "Your form data is saved.",
    savedRest:
      "Top up your wallet and come back — your form will be ready to submit.",
  },
  accept_worker: {
    cost: (amount, balance) => (
      <>
        Accepting this worker locks{" "}
        <strong className="text-base-content">
          ₹{Number(amount || 0).toFixed(2)}
        </strong>{" "}
        in escrow. Your current balance is{" "}
        <strong className="text-base-content">
          ₹{balance.toFixed(2)}
        </strong>
        .
      </>
    ),
    savedLead: "Nothing has been accepted yet.",
    savedRest: "Top up your wallet, then come back and click Accept again.",
  },
};

// Pure content — same JSX the old AuthModal `TopupPrompt` used to render.
// Caller is responsible for wrapping it in a modal-box.
export function TopupPromptContent({
  requiredAmount = 0,
  currentBalance = 0,
  context = "post_shift",
  onClose,
}) {
  const copy = VARIANTS[context] || VARIANTS.post_shift;
  const balance = Number(currentBalance || 0);

  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 bg-success/10 text-success rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Wallet className="w-6 h-6" />
      </div>
      <h3 className="font-extrabold text-xl mb-2">Top up your wallet</h3>
      <p className="text-sm text-base-content/70 leading-relaxed mb-6">
        {copy.cost(requiredAmount, balance)}
      </p>

      <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-xs text-base-content/80 text-left mb-6 leading-relaxed flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <span>
          <strong>{copy.savedLead}</strong> {copy.savedRest}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-ghost flex-1 rounded-xl"
          onClick={onClose}
        >
          Cancel
        </button>
        <Link
          to="/dashboard"
          className="btn btn-primary flex-1 rounded-xl shadow-sm shadow-primary/20 gap-1.5"
          onClick={onClose}
        >
          Go to Wallet <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// Self-contained modal — used from pages NOT inside AuthModal (MyShifts).
// Same content, wrapped in a proper backdrop + modal-box + framer-motion.
export function TopupPromptModal({
  open,
  requiredAmount,
  currentBalance,
  context,
  onClose,
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="modal modal-open modal-bottom sm:modal-middle z-110"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className="modal-backdrop bg-neutral/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="modal-box sm:max-w-md bg-base-100 p-6 sm:p-7 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-200 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <TopupPromptContent
              requiredAmount={requiredAmount}
              currentBalance={currentBalance}
              context={context}
              onClose={onClose}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default TopupPromptModal;