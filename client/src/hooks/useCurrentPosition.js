// client/src/hooks/useCurrentPosition.js
// On-demand "Use my current location". Unlike useGeolocation (which runs on mount and
// silently falls back to a default city), this NEVER invents a position: it either
// resolves with real coordinates or rejects with a reason the UI can show.
import { useCallback, useState } from "react";

function positionError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const TIMEOUT_MS = 10000;

export function useCurrentPosition() {
  const [locating, setLocating] = useState(false);

  const locate = useCallback(
    () =>
      new Promise((resolve, reject) => {
        // Browsers only expose geolocation on HTTPS (and localhost).
        if (typeof window === "undefined" || !window.isSecureContext) {
          return reject(positionError("INSECURE", "Location needs a secure (HTTPS) connection. Search for the address instead."));
        }
        if (!("geolocation" in navigator)) {
          return reject(positionError("UNSUPPORTED", "This device can't share its location. Search for the address instead."));
        }

        let settled = false;
        const finish = (fn, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          setLocating(false);
          fn(value);
        };
        // Some browsers never fire the native timeout while the permission prompt is open.
        const guard = setTimeout(
          () => finish(reject, positionError("TIMEOUT", "Finding your location took too long. Search for the address instead.")),
          TIMEOUT_MS + 2000,
        );

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => finish(resolve, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          (err) => {
            if (err.code === 1) finish(reject, positionError("DENIED", "Location permission was denied. Search for the address instead."));
            else if (err.code === 3) finish(reject, positionError("TIMEOUT", "Finding your location took too long. Search for the address instead."));
            else finish(reject, positionError("UNAVAILABLE", "Your location isn't available right now. Search for the address instead."));
          },
          { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 30000 },
        );
      }),
    [],
  );

  return { locate, locating };
}