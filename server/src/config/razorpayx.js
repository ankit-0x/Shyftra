// server/src/config/razorpayx.js
// RazorpayX (Contacts/Fund Accounts/Payouts) is NOT wrapped by the
// `razorpay` npm package — that package only covers the Payment Gateway
// side (Orders, Payments, Refunds). RazorpayX has its own REST API, so we
// call it directly here using Node's built-in fetch.

const BASE_URL = "https://api.razorpay.com/v1";

function getAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export async function razorpayXRequest(path, method, body, idempotencyKey) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: getAuthHeader(),
  };

  // Mandatory since March 2025. The key must be STABLE per payout intent —
  // if it changes on retry, RazorpayX treats the retry as a brand-new
  // payout and pays twice. So we require the caller to supply it rather
  // than generating one here.
  if (path === "/payouts" && method === "POST") {
    if (!idempotencyKey) {
      throw new Error(
        "razorpayXRequest: idempotencyKey is required for POST /payouts",
      );
    }
    headers["X-Payout-Idempotency"] = idempotencyKey;
  }

  // Network-level failures (timeout, DNS, connection refused) happen BEFORE
  // we get any HTTP response. Wrap them so callers can distinguish
  // "safe to retry with same idempotency key" from "business rejection".
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000), // don't hang forever
    });
  } catch (netErr) {
    const isTimeout = netErr.name === "TimeoutError" || netErr.name === "AbortError";
    const e = new Error(
      isTimeout
        ? "RazorpayX request timed out — safe to retry with the same idempotency key"
        : netErr.message || "RazorpayX network error",
    );
    e.code = isTimeout ? "NETWORK_TIMEOUT" : "NETWORK";
    e.retryable = true; // idempotency key protects against double-pay on retry
    throw e;
  }

  // Non-JSON body: 4xx/5xx often returns HTML from gateways (fallback to {});
  // but a 2xx with unparseable body is a real bug — don't pretend success.
  let data;
  try {
    data = await res.json();
  } catch {
    if (res.ok) {
      const e = new Error(
        `RazorpayX returned non-JSON success response (status ${res.status})`,
      );
      e.razorpayStatus = res.status;
      throw e;
    }
    data = {};
  }

  if (!res.ok) {
    const e = new Error(data.error?.description || "RazorpayX request failed");
    e.razorpayStatus = res.status;
    throw e;
  }
  return data;
}

const PAYOUT_STATUS_MAP = {
  queued: "processing",
  pending: "processing",
  processing: "processing",
  processed: "success",
  reversed: "reversed",
  rejected: "failed",
  cancelled: "failed",
  failed: "failed",
};

export function mapPayoutStatus(razorpayStatus) {
  return PAYOUT_STATUS_MAP[razorpayStatus] || "processing";
}