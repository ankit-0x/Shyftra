// client/src/components/ChangePasswordCard.jsx   (used inside pages/Profile.jsx)
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { KeyRound, Loader2, Info } from "lucide-react";
import { changePasswordSchema } from "../schemas/password";
import { changePassword } from "../store/authSlice";
import { socket } from "../socket";
import PasswordInput from "./PasswordInput";
import PasswordStrength from "./PasswordStrength";

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-error text-xs mt-1 font-medium">{error.message}</p>}
    </div>
  );
}

function ChangePasswordCard() {
  const dispatch = useDispatch();
  const {
    register, handleSubmit, control, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });
  const newPassword = useWatch({ control, name: "newPassword" }) || "";

  async function onSubmit(values) {
    try {
      await dispatch(changePassword(values)).unwrap();
      toast.success("Password changed. Your other devices were logged out.");
      reset();
      // The server closed every socket (including ours) and issued fresh cookies:
      // reconnect this tab so live updates keep working.
      socket.disconnect();
      socket.connect();
    } catch (e) {
      // e = { message, code }
      if (e?.code === "WRONG_CURRENT_PASSWORD") setError("currentPassword", { message: e.message });
      else if (e?.code === "SAME_PASSWORD") setError("newPassword", { message: e.message });
      else toast.error(e?.message || "Could not change password");
    }
  }

  return (
    <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
      <div className="p-6 border-b border-base-200 bg-base-200/30">
        <h3 className="font-bold text-lg flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Change password</h3>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Current password" error={errors.currentPassword}>
          <PasswordInput {...register("currentPassword")} autoComplete="current-password" error={errors.currentPassword} />
        </Field>
        <Field label="New password" error={errors.newPassword}>
          <PasswordInput {...register("newPassword")} autoComplete="new-password" error={errors.newPassword} />
          <PasswordStrength password={newPassword} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmNewPassword}>
          <PasswordInput {...register("confirmNewPassword")} autoComplete="new-password" error={errors.confirmNewPassword} />
        </Field>
        <div className="flex items-start gap-2 text-xs text-base-content/60 bg-info/5 border border-info/20 rounded-xl p-3">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          Changing your password signs you out of every other device. This one stays signed in.
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting} className="btn btn-primary rounded-xl w-full sm:w-auto sm:px-8">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChangePasswordCard;
