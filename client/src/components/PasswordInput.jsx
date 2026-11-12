// client/src/components/PasswordInput.jsx
// Input with a show/hide eye. Works with react-hook-form's register() via forwardRef-less
// React 19 `ref` prop: <PasswordInput {...register("x")} />
import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

function PasswordInput({ error, className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center">
      <Lock className="absolute left-3 w-4 h-4 text-base-content/40 pointer-events-none" />
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`input input-bordered w-full pl-10 pr-10 bg-base-100 focus:outline-primary/50 focus:border-primary ${error ? "input-error" : ""} ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 text-base-content/40 hover:text-base-content transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default PasswordInput;
