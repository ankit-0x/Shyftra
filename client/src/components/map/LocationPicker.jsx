// client/src/components/map/LocationPicker.jsx
// Work-site picker used by PostShiftForm and EditShiftModal.
//   (A) "Use my current location"  -> real device position + reverse-geocoded address
//   (B) type an address            -> debounced suggestions -> pick one -> pin on the map
// Either way the employer can fine-tune by dragging the pin or tapping the map.
// It is a CONTROLLED component: the parent owns { address, lat, lng }.
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, LocateFixed, Loader2, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useCooldown } from "../../hooks/useCooldown";
import { useCurrentPosition } from "../../hooks/useCurrentPosition";
import { autocomplete, searchAddress, reverseGeocode } from "../../api/geocodeApi";

const LocationMap = lazy(() => import("./LocationMap"));

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

function LocationPicker({ address = "", lat, lng, onChange, error, centerHint, disabled = false }) {
  const listId = useId();
  const hasPin = lat != null && lng != null;

  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | empty | error | busy
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focusKey, setFocusKey] = useState(0); // bump => map flies to the pin
  const [notice, setNotice] = useState(null); // { tone: "info" | "warn" | "ok", text }
  const [confirmedLabel, setConfirmedLabel] = useState(null);

  const { locate, locating } = useCurrentPosition();
  const { left: busyLeft, start: startBusy } = useCooldown();

  // Latest value for async callbacks (they would otherwise see stale props).
  const valueRef = useRef({ address, lat, lng });
  useEffect(() => {
    valueRef.current = { address, lat, lng };
  });
  const userTyped = useRef(false); // only TYPING triggers suggestions, not programmatic changes
  const moveSeq = useRef(0); // ignores stale reverse-geocode answers

  const debounced = useDebouncedValue(address, DEBOUNCE_MS);

  // ---- autocomplete: debounced, cancellable, paused while the server says "slow down" ----
  useEffect(() => {
    if (!userTyped.current) return undefined;
    const q = debounced.trim();
    if (q.length < MIN_CHARS || busyLeft > 0) return undefined;

    const controller = new AbortController();
    const focus = valueRef.current.lat != null ? { lat: valueRef.current.lat, lng: valueRef.current.lng } : centerHint;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting a request is the point of this effect
    setStatus("loading");
    autocomplete(q, { focus, signal: controller.signal })
      .then((results) => {
        setSuggestions(results);
        setStatus(results.length ? "idle" : "empty");
        setActive(-1);
        setOpen(true);
      })
      .catch((err) => {
        if (err.canceled) return;
        setSuggestions([]);
        if (err.busy) {
          startBusy(err.retryAfter ?? 30);
          setStatus("busy");
          setMessage("Address search is busy right now. Use your location or tap the map to place the pin.");
        } else {
          setStatus("error");
          setMessage(err.message || "Address search failed. You can still tap the map to place the pin.");
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- centerHint/busyLeft are read, not triggers
  }, [debounced]);

    function emit(next) {
    const updated = { ...valueRef.current, ...next };
    // Update the ref SYNCHRONOUSLY, before the parent re-renders. Otherwise two
    // emits in the same async flow (e.g. "use my location" -> set lat/lng ->
    // await cached reverse-geocode -> set address) race: the second emit can
    // read stale lat/lng and overwrite the first emit's values.
    valueRef.current = updated;
    onChange(updated);
  }

  function applyPlace(place) {
    userTyped.current = false;
    setConfirmedLabel(place.label);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    setStatus("idle");
    setNotice(null);
    emit({ address: place.label, lat: place.lat, lng: place.lng });
    setFocusKey((k) => k + 1);
  }

  // Pin moved by drag/tap: keep the address text honest by looking it up again.
  async function handleMapMove(newLat, newLng) {
    const seq = ++moveSeq.current;
    emit({ lat: newLat, lng: newLng });
    setNotice({ tone: "info", text: "Pin moved. Looking up the address…" });
    try {
      const [place] = await reverseGeocode(newLat, newLng);
      if (seq !== moveSeq.current) return;
      if (place) {
        userTyped.current = false;
        setConfirmedLabel(place.label);
        emit({ address: place.label });
        setNotice({ tone: "ok", text: "Address updated from the pin. Edit it if needed." });
      } else {
        setNotice({ tone: "warn", text: "Pin moved, but no address was found there. Check the address text." });
      }
    } catch (err) {
      if (seq !== moveSeq.current || err.canceled) return;
      setNotice({ tone: "warn", text: "Pin moved, but we couldn't look up the address. Check the address text." });
    }
  }

  async function handleUseMyLocation() {
    setNotice(null);
    try {
      const pos = await locate();
      const seq = ++moveSeq.current;
      emit({ lat: pos.lat, lng: pos.lng });
      setFocusKey((k) => k + 1);
      setNotice({ tone: "info", text: "Got your location. Looking up the address…" });
      try {
        const [place] = await reverseGeocode(pos.lat, pos.lng);
        if (seq !== moveSeq.current) return;
        if (place) {
          userTyped.current = false;
          setConfirmedLabel(place.label);
          emit({ address: place.label });
          setNotice({ tone: "ok", text: "Location set. Drag the pin to fine-tune." });
        } else {
          setNotice({ tone: "warn", text: "Pin placed, but no street address was found. Type the address." });
        }
      } catch {
        if (seq === moveSeq.current) setNotice({ tone: "warn", text: "Pin placed, but we couldn't look up the address. Type it in." });
      }
    } catch (err) {
      setNotice({ tone: "warn", text: err.message });
    }
  }

  // Enter with no highlighted suggestion = "convert this typed address to coordinates".
  async function handleSearch() {
    const q = address.trim();
    if (q.length < MIN_CHARS) return;
    setStatus("loading");
    setOpen(false);
    try {
      const results = await searchAddress(q);
      if (results.length === 0) {
        setStatus("empty");
        return;
      }
      applyPlace(results[0]);
    } catch (err) {
      if (err.busy) {
        startBusy(err.retryAfter ?? 30);
        setStatus("busy");
        setMessage("Address search is busy right now. Use your location or tap the map to place the pin.");
      } else {
        setStatus("error");
        setMessage(err.message || "Address search failed. You can still tap the map to place the pin.");
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the whole shift form from this box
      if (open && active >= 0 && suggestions[active]) applyPlace(suggestions[active]);
      else handleSearch();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const edited = hasPin && confirmedLabel !== null && address.trim() !== confirmedLabel;
  const toneClass = { info: "text-info", warn: "text-warning", ok: "text-success" };
  const ToneIcon = { info: Info, warn: AlertTriangle, ok: CheckCircle2 };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative flex items-center">
          <MapPin className="absolute left-3.5 w-4 h-4 text-base-content/40 pointer-events-none" />
          <input
            type="text"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={!!error}
            value={address}
            disabled={disabled}
            autoComplete="off"
            placeholder="Search the work site address"
            onChange={(e) => {
              userTyped.current = true;
              setOpen(true);
              setStatus("idle");
              emit({ address: e.target.value });
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setOpen(false)}
            onFocus={() => suggestions.length && setOpen(true)}
            className={`input input-bordered w-full pl-10 pr-12 rounded-xl focus:outline-primary/20 focus:border-primary text-sm ${error ? "border-error" : ""}`}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={disabled || status === "loading" || address.trim().length < MIN_CHARS}
            aria-label="Find this address on the map"
            className="absolute right-1.5 btn btn-ghost btn-sm btn-square rounded-lg"
          >
            {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-base-200 bg-base-100 shadow-xl"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyPlace(s);
                }}
                className={`flex items-start gap-2 px-3 py-2.5 text-sm cursor-pointer ${i === active ? "bg-primary/10" : "hover:bg-base-200"}`}
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-base-content/40" />
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="space-y-1">
        {status === "empty" && (
          <p className="text-xs text-base-content/60">No matches. Try fewer words, or tap the map to place the pin.</p>
        )}
        {(status === "error" || status === "busy") && (
          <p className="text-xs text-warning flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {message}
              {status === "busy" && busyLeft > 0 ? ` (search resumes in ${busyLeft}s)` : ""}
            </span>
          </p>
        )}
        {notice && (
          (() => {
            const Icon = ToneIcon[notice.tone];
            return (
              <p className={`text-xs flex items-start gap-1.5 ${toneClass[notice.tone]}`}>
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{notice.text}</span>
              </p>
            );
          })()
        )}
        {edited && (
          <p className="text-xs text-warning flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>You edited the address. Make sure the pin is still on the right spot.</span>
          </p>
        )}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="btn btn-outline btn-sm rounded-xl gap-2 w-full sm:w-auto"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      )}

      <Suspense fallback={<div className="h-64 w-full rounded-2xl bg-base-200 animate-pulse" aria-label="Loading map" />}>
        <LocationMap
          lat={lat}
          lng={lng}
          focusKey={focusKey}
          centerHint={centerHint}
          interactive={!disabled}
          onMove={handleMapMove}
        />
      </Suspense>

      <p className="text-xs text-base-content/60 flex items-center gap-1.5">
        {hasPin ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Pin set. {disabled ? "" : "Drag it or tap the map to fine-tune."}
          </>
        ) : (
          "No pin yet: pick a suggestion, use your location, or tap the map."
        )}
      </p>

      {error && <p className="text-error text-xs font-medium" role="alert">{error}</p>}
    </div>
  );
}

export default LocationPicker;