// server/src/utils/money.js
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const toRupees = (paise) => paise / 100;

// Ledger fields stored as integer paise that clients should see as rupees.
// If you add a new money field to a model, add its name here.
const PAISE_KEYS = new Set([
  "walletBalance", "amount", "balanceAfter",
  "escrowAmount", "maxPayout", "refundToEmployer", "penaltyToWorker",
  "amountEarned", "employerRefund", "totalEarnings", "totalSpent", "platformFee",
  "totalEarned", "totalPaidOut", "proposedAmountEarned", "penaltyPaidToYou",
]);

export function moneyToRupees(value, key = null) {
  if (Array.isArray(value)) return value.map((v) => moneyToRupees(v, key));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = moneyToRupees(v, k);
    return out;
  }
  if (typeof value === "number" && PAISE_KEYS.has(key)) return value / 100;
  return value;
}

// Serialize first so Mongoose documents, ObjectIds and dates become plain JSON.
export function toClientJson(body) {
  return moneyToRupees(JSON.parse(JSON.stringify(body)));
}