// client/src/hooks/useCooldown.js
// Countdown for "Resend" buttons.  const { left, start } = useCooldown(); start(60);
import { useCallback, useEffect, useState } from "react";

export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const start = useCallback((seconds = 60) => setLeft(seconds), []);
  return { left, start };
}
