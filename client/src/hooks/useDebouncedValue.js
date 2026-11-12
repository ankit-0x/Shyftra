// client/src/hooks/useDebouncedValue.js
// Returns a version of "value" that only updates after it has stopped
// changing for `delay` milliseconds — used to avoid firing an API call
// on every single keystroke.

import { useState, useEffect } from "react";

export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Every time "value" changes, cancel the previous timer and start a new one.
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // cleanup: runs before the next effect
  }, [value, delay]);

  return debounced;
}