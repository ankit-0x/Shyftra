// client/src/constants/businessRules.js
// Mirrors server/src/config/businessRules.js.
export const PLATFORM_FEE_FLAT = 20;
export const LATE_CANCELLATION_WINDOW_HOURS = 2;
export const LATE_CANCELLATION_PENALTY_FLAT = 100;
// Defaults of the server's MIN_WITHDRAWAL / MAX_WITHDRAWAL env vars (rupees).
// The server is the authority and returns its own message if these differ.
export const MIN_WITHDRAWAL = 100;
export const MAX_WITHDRAWAL = 50000;
// Strikes at which an account is suspended. The cancel dialog gets the real
// number from the server; this is only the default for the strike meter.
export const MAX_STRIKES = 3;
export const FREE_SHIFTS_LIMIT = 3;