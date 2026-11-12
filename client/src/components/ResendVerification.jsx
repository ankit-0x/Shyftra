// client/src/components/ResendVerification.jsx
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import toast from "react-hot-toast";
import { resendVerificationEmail, apiError } from "../api/authApi";
import { useCooldown } from "../hooks/useCooldown";

function ResendVerification({ email, startCooldown = false }) {
  const [sending, setSending] = useState(false);
  const { left, start } = useCooldown();
  const [initDone, setInitDone] = useState(false);
  if (startCooldown && !initDone) {
    setInitDone(true);
    start(60); // the register call just sent one
  }

  async function handleResend() {
    setSending(true);
    try {
      await resendVerificationEmail(email);
      toast.success("A new verification link is on its way.");
      start(60);
    } catch (err) {
      const e = apiError(err);
      toast.error(e.message);
      if (e.status === 429) start(60);
    } finally {
      setSending(false);
    }
  }

  return (
    <button type="button" onClick={handleResend} disabled={sending || left > 0} className="btn btn-outline btn-sm rounded-xl gap-2 w-full">
      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
      {left > 0 ? `Resend in ${left}s` : "Resend verification email"}
    </button>
  );
}

export default ResendVerification;
