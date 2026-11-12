// client/src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends the httpOnly cookies automatically — no manual token attaching needed
});

// These two variables coordinate MULTIPLE requests failing with 401 at the
// same moment (e.g. a page that fires 3 API calls at once) — without this,
// each one would independently try to refresh, causing 3 refresh calls
// instead of 1.
// A 401 from these means "wrong credentials / bad token", NOT "session expired",
// so we must never try to refresh + retry them.
const AUTH_URLS_WITHOUT_REFRESH = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response, // pass successful responses straight through
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint = AUTH_URLS_WITHOUT_REFRESH.some((u) =>
      requestUrl.includes(u),
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true; // only ever attempt this once per request

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await api.post("/api/auth/refresh");
        } catch (refreshError) {
          refreshSubscribers.forEach((cb) => cb(refreshError));
          refreshSubscribers = [];
          isRefreshing = false;

          // ✅ NEW: refresh token is dead → force client-side logout.
          // We dispatch a custom event (no circular import on the store).
          // App.jsx will listen for this and dispatch(logoutUser) / clear state.
          window.dispatchEvent(new CustomEvent("auth:force-logout"));

          return Promise.reject(error);
        }
        isRefreshing = false;
        onRefreshed(); // wake up any other requests that were waiting
        // FIX: the request that *started* the refresh must retry itself.
        // Previously it queued a resolver after onRefreshed() had already
        // fired, so it never resolved (endless spinner on page load).
        return api(originalRequest);
      }

      // Another request is already refreshing: wait for it, then retry.
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((refreshError) =>
          refreshError ? reject(error) : resolve(api(originalRequest)),
        );
      });
    }

    return Promise.reject(error);
  },
);

export default api;
