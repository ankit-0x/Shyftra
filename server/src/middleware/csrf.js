// server/src/middleware/csrf.js
import { ALLOWED_ORIGIN } from "../config/origin.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Browsers always attach Origin to cross-site POST/PUT/PATCH/DELETE. A
// missing Origin means a non-browser client (Razorpay's webhook, curl),
// which has no ambient browser cookies to abuse.
export function requireSameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || origin === ALLOWED_ORIGIN) return next();
  return res.status(403).json({ error: "Cross-site request blocked" });
}