// client/src/components/OtpInput.jsx
import { useRef, useState, useEffect } from "react";

const LENGTH = 6;

// Self-contained: manages its own per-box state and only reports a code
// up via onComplete once all boxes are filled — the parent never has to
// reason about partial or out-of-order input.
//
// To clear the boxes after a failed attempt the parent bumps `reset`; the
// outer component turns that into a `key`, which remounts a fresh inner
// instance (cleaner than resetting state from inside an effect).
function OtpBoxes({ onComplete, disabled }) {
  const [boxes, setBoxes] = useState(() => Array(LENGTH).fill(""));
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Report completion from the event that produced it, not from an effect.
  function commit(next) {
    setBoxes(next);
    if (next.every((c) => c !== "")) onComplete(next.join(""));
  }

  function updateBox(index, char) {
    const next = [...boxes];
    next[index] = char;
    commit(next);
    if (char && index < LENGTH - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !boxes[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, LENGTH).split("");
    commit(Array.from({ length: LENGTH }, (_, i) => pasted[i] || ""));
    inputsRef.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex gap-1.5 sm:gap-2" onPaste={handlePaste}>
      {boxes.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          value={digit}
          onChange={(e) => updateBox(i, e.target.value.replace(/[^0-9]/g, "").slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          maxLength={1}
          className="w-10 h-12 sm:w-11 sm:h-14 text-center text-xl font-mono font-black rounded-xl border-2 border-base-200 bg-base-100 shadow-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none disabled:opacity-50 disabled:bg-base-200/60 disabled:cursor-not-allowed disabled:shadow-none"
        />
      ))}
    </div>
  );
}

function OtpInput({ onComplete, disabled, reset }) {
  return <OtpBoxes key={reset} onComplete={onComplete} disabled={disabled} />;
}

export default OtpInput;