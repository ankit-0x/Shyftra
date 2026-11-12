// client/src/hooks/useGeolocation.js
import { useState, useEffect } from "react";

const DEFAULT_LOCATION = { lat: 19.076, lng: 72.8777 };

const isSupported = () =>
  typeof navigator !== "undefined" && "geolocation" in navigator;

export function useGeolocation() {
  const [state, setState] = useState(() => ({
    location: isSupported() ? null : DEFAULT_LOCATION,
    permissionDenied: false,
  }));

  useEffect(() => {
    if (!isSupported()) return;
    let cancelled = false;

    // Retry once on timeout — first load par permission prompt time le leta hai
    const tryFetch = (retriesLeft) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          setState({
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            permissionDenied: false,
          });
        },
        (err) => {
          if (cancelled) return;
          // Code 3 = TIMEOUT → retry karo (permission prompt ne time liya)
          if (err.code === 3 && retriesLeft > 0) {
            tryFetch(retriesLeft - 1);
            return;
          }
          // Denied (1) / unavailable (2) / final timeout → fallback
          setState({
            location: DEFAULT_LOCATION,
            permissionDenied: true,
          });
        },
        {
          timeout: 25000,       // 👈 10s → 25s (permission + GPS ke liye)
          maximumAge: 60000,    // same (refresh pe cache se fast milega)
        },
      );
    };

    tryFetch(1); // 1 retry = max 2 attempts, ~50s total
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}