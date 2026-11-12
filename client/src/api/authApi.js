// client/src/api/authApi.js
// Plain API calls for flows whose result only matters to ONE screen (no shared
// state), so they don't need Redux: component state is enough.
import api from "./axios";

// Normalises axios errors into { message, code, status, retryAfter, ... }.
export function apiError(err, fallback = "Something went wrong") {
  const d = err.response?.data || {};
  return {
    message: d.error || (err.response ? fallback : "Network error — check your connection and try again."),
    code: d.code || (err.response ? null : "NETWORK"),
    status: err.response?.status ?? 0,
    retryAfter: d.retryAfter,
    attemptsLeft: d.attemptsLeft,
    cooldownUntil: d.cooldownUntil,
  };
}

export const verifyEmailToken = (token) => api.post(`/api/auth/verify-email/${encodeURIComponent(token)}`).then((r) => r.data);
export const resendVerificationEmail = (email) => api.post("/api/auth/resend-verification", { email }).then((r) => r.data);
export const requestPasswordReset = (email) => api.post("/api/auth/forgot-password", { email }).then((r) => r.data);
export const resetPasswordWithToken = (token, password) =>
  api.post(`/api/auth/reset-password/${encodeURIComponent(token)}`, { password }).then((r) => r.data);
