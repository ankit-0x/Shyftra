// server/src/utils/istTime.js
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// First instant of the current calendar month in India (IST), as a UTC Date.
// Render servers run in UTC, so new Date(y, m, 1) would start the month 5.5h late.
export function startOfMonthIST(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}
