// config/businessRules.js

function numberFromEnv(varName, fallback) {
  const raw = process.env[varName];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${varName}: "${raw}" must be a non-negative number`);
  }
  return parsed;
}

// Env vars stay in human rupees; constants become paise.
function rupeesEnvAsPaise(name, fallbackRupees) {
  return Math.round(numberFromEnv(name, fallbackRupees) * 100);
}

// ---- Money (paise) ----
export const PLATFORM_FEE_FLAT = rupeesEnvAsPaise("PLATFORM_SHIFT_FEE", 20);
export const LATE_CANCELLATION_PENALTY_FLAT = rupeesEnvAsPaise("EMPLOYER_LATE_CANCEL_PENALTY", 100);
export const MIN_WITHDRAWAL = rupeesEnvAsPaise("MIN_WITHDRAWAL", 100);
export const MAX_WITHDRAWAL = rupeesEnvAsPaise("MAX_WITHDRAWAL", 50000);
export const MAX_TOPUP = rupeesEnvAsPaise("MAX_TOPUP", 100000);

// ---- Time / distance (raw units) ----
export const LATE_CANCELLATION_WINDOW_HOURS = numberFromEnv("EMPLOYER_LATE_CANCEL_WINDOW_HOURS", 2);
export const NO_SHOW_GRACE_MINUTES = numberFromEnv("NO_SHOW_GRACE_MINUTES", 30);
export const CLOCK_IN_EARLY_MINUTES = numberFromEnv("CLOCK_IN_EARLY_MINUTES", 30);
export const ARRIVAL_RADIUS_METERS = numberFromEnv("ARRIVAL_RADIUS_METERS", 300);
export const TOPUP_HOLD_HOURS = numberFromEnv("TOPUP_HOLD_HOURS", 48);
export const EARNINGS_HOLD_HOURS = numberFromEnv("EARNINGS_HOLD_HOURS", 24);
// A worker who cancels an ACCEPTED shift at least this many hours before it
// starts gets a "free" cancellation (full refund to the employer, NO strike).
// Later than that costs a strike. Set to 0 to disable free cancellation.
export const WORKER_FREE_CANCEL_HOURS = numberFromEnv("WORKER_FREE_CANCEL_HOURS", 24);
// Number of free shift posts each employer gets before verification is required.
export const FREE_SHIFTS_LIMIT = numberFromEnv("FREE_SHIFTS_LIMIT", 3);