import { useEffect, useState } from "react";

export function useLiveTick(eventName, onlyShiftId) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let timer;
    const handler = (e) => {
      const id = e.detail?.shiftId;
      if (onlyShiftId && id && String(id) !== String(onlyShiftId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setTick((t) => t + 1), 300 + Math.random() * 1500);
    };
    window.addEventListener(eventName, handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(eventName, handler);
    };
  }, [eventName, onlyShiftId]);
  return tick;
}