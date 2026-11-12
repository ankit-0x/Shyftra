// client/src/components/PasswordStrength.jsx
import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "../schemas/password";

function PasswordStrength({ password = "" }) {
  if (!password) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={`flex items-center gap-1.5 text-[11px] font-medium ${ok ? "text-success" : "text-base-content/50"}`}>
            {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

export default PasswordStrength;
