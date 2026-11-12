const RELOAD_KEY = "shyftra_chunk_reload_at";
const MIN_GAP_MS = 30_000;

export function isChunkLoadError(err) {
  const msg = String(err?.message ?? err ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(msg);
}

// Returns true if a reload was triggered, false if one already happened in the
// last 30 seconds (so a genuinely broken deploy shows the fallback, not a loop).
export function reloadOnceForNewDeploy() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* sessionStorage can be blocked: allow the single attempt */ }
  window.location.reload();
  return true;
}