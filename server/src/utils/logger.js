// server/src/utils/logger.js
// One JSON line per log event, with personal data scrubbed.
//
// Why: MongoDB's duplicate-key error puts the user's email in BOTH err.message
// and err.keyValue, SMTP errors echo recipient addresses, and validation errors
// can echo submitted values. Logging those raw copies personal data into your
// host's log retention.

// Matches emails AND UPI addresses (handle@bank has no dot-domain).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*/g;
// Indian mobile numbers, with or without +91 and with an optional space/dash in the middle.
const PHONE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const DUP_KEY = /dup key:\s*\{[^}]*\}/gi;
const SECRETS = /(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]*|Bearer\s+[\w.~+/=-]+|Basic\s+[A-Za-z0-9+/=]{12,})/g;

export function scrub(value) {
  if (value == null) return value;
  return String(value)
    .replace(DUP_KEY, "dup key: {[redacted]}")
    .replace(SECRETS, "[secret]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[phone]");
}

export function describeError(err) {
  if (err == null) return { message: "unknown error" };
  if (typeof err !== "object") return { message: scrub(err) };

  const out = { name: err.name };
  if (err.code !== undefined) out.code = err.code;
  if (err.statusCode ?? err.status) out.status = err.statusCode ?? err.status;

  if (err.name === "ValidationError" && err.errors) {
    // Mongoose echoes the rejected values in its message; log only the field names.
    out.message = `validation failed on: ${Object.keys(err.errors).join(", ")}`;
  } else if (err.error && typeof err.error === "object" && !(err instanceof Error)) {
    // Razorpay SDK style: { statusCode, error: { code, description } }
    out.code = err.error.code ?? out.code;
    out.message = scrub(err.error.description ?? "payment provider error");
  } else {
    out.message = scrub(err.message ?? err);
  }
  if (err.stack) out.stack = scrub(String(err.stack).split("\n").slice(1, 6).join("\n"));
  return out;
}

function emit(level, context, err) {
  const line = { level, time: new Date().toISOString(), msg: scrub(context), err: describeError(err) };
  (level === "warn" ? console.warn : console.error)(JSON.stringify(line));
}

export const logError = (context, err) => emit("error", context, err);
export const logWarn = (context, err) => emit("warn", context, err);