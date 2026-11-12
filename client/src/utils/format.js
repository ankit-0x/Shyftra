// client/src/utils/format.js
// Small, pure helper functions — no React here, just plain JS math,
// so they're easy to test and reuse anywhere.

// Turns 2300 (meters) into "2.3 km" or 800 into "800 m"
export function formatDistance(meters) {
  if (meters == null) return "";
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

// Turns a future Date into "starts in 3h" or "starts in 45m"
export function formatStartsIn(startTime) {
  const diffMs = new Date(startTime) - new Date();
  if (diffMs <= 0) return "starting now";

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) {
    return `starts in ${Math.round(diffHours * 60)}m`;
  }
  return `starts in ${Math.round(diffHours)}h`;
}

// "just now", "5 minutes ago", "3 days ago"; falls back to a plain date after
// ~30 days. Pair it with formatDateTime in a `title` so the exact time is one hover away.
export function formatRelativeTime(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - Date.now()) / 1000); // negative = past
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return new Date(then).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// "12 Mar 2026, 4:30 pm"
export function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
