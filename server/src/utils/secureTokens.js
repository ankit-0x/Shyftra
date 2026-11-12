// server/src/utils/secureTokens.js
import crypto from "crypto";

// Random URL-safe token. The RAW token goes in the email link; only the
// SHA-256 HASH is stored in the DB, so a DB leak cannot be used to verify
// emails or reset passwords.
export function createUrlToken() {
  const raw = crypto.randomBytes(32).toString("hex"); // 256 bits
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export function createNumericOtp() {
  return crypto.randomInt(100000, 1000000).toString(); // 6 digits, CSPRNG
}

// Constant-time compare of two hex digests.
export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a ?? ""), "utf8");
  const y = Buffer.from(String(b ?? ""), "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
