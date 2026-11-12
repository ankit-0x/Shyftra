// server/src/middleware/rateLimiters.js
import rateLimit from "express-rate-limit";
import redisClient from "../config/redis.js";
import { RedisRateLimitStore } from "./redisRateLimitStore.js";

// Shared Redis counters: they survive restarts and are shared by every instance.
// passOnStoreError: if Redis is unavailable the request is allowed (the store
// gives up after 500 ms) instead of failing or hanging.
const redisStore = (name) => ({
  store: new RedisRateLimitStore({ client: redisClient, prefix: name }),
  passOnStoreError: true,
});

// Register: count every attempt.
export const registerLimiter = rateLimit({
  ...redisStore("registerLimiter"),
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: "Too many sign-ups from this network, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login, layer 1: per network, failures only.
export const loginIpLimiter = rateLimit({
  ...redisStore("loginIpLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login, layer 2: per account, failures only. Stops password guessing
// against one email from many IPs.
export const loginAccountLimiter = rateLimit({
  ...redisStore("loginAccountLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: (req) => typeof req.body?.email !== "string",
  keyGenerator: (req) => `login:${req.body.email.trim().toLowerCase()}`,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refresh: successful refreshes are normal traffic; only failures count.
export const refreshLimiter = rateLimit({
  ...redisStore("refreshLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpRequestLimiter = rateLimit({
  ...redisStore("otpRequestLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 20,                                   // `limit` is the newer name for `max`
  keyGenerator: (req) => req.user._id.toString(), // per logged-in user, not per IP
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const browseLimiter = rateLimit({
  ...redisStore("browseLimiter"),
  windowMs: 60 * 1000,
  limit: 60, // 60 requests per minute per IP
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  ...redisStore("uploadLimiter"),
  windowMs: 60 * 60 * 1000,
  limit: 20, // 20 uploads per hour per user
  keyGenerator: (req) => req.user._id.toString(), // must run after requireAuth
  message: { error: "Too many uploads, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});


// ---------- Email-based flows (verification / reset) ----------
// Layer 1: per network.
export const emailFlowIpLimiter = rateLimit({
  ...redisStore("emailFlowIpLimiter"),
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Layer 2: per target email (stops mail-bombing one inbox from many IPs).
// Runs for existing AND non-existing emails alike, so it leaks nothing.
const emailKey = (prefix) => (req) => `${prefix}:${String(req.body.email).trim().toLowerCase()}`;
const hasEmail = (req) => typeof req.body?.email !== "string";

export const resendVerificationLimiter = rateLimit({
  ...redisStore("resendVerificationLimiter"),
  windowMs: 60 * 60 * 1000, limit: 5, skip: hasEmail, keyGenerator: emailKey("verify"),
  message: { error: "Too many verification emails requested. Try again later." },
  standardHeaders: true, legacyHeaders: false,
});
export const forgotPasswordLimiter = rateLimit({
  ...redisStore("forgotPasswordLimiter"),
  windowMs: 60 * 60 * 1000, limit: 5, skip: hasEmail, keyGenerator: emailKey("forgot"),
  message: { error: "Too many reset requests. Try again later." },
  standardHeaders: true, legacyHeaders: false,
});

// Guessing a reset/verify token is infeasible (256-bit) but cap it anyway.
export const tokenSubmitLimiter = rateLimit({
  ...redisStore("tokenSubmitLimiter"),
  windowMs: 15 * 60 * 1000, limit: 20,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true, legacyHeaders: false,
});

// ---------- Logged-in sensitive actions (keyed per user; run AFTER requireAuth) ----------
export const changePasswordLimiter = rateLimit({
  ...redisStore("changePasswordLimiter"),
  windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true,
  keyGenerator: (req) => `chpw:${req.user._id}`,
  message: { error: "Too many password attempts. Try again in 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
});
export const payoutOtpSendLimiter = rateLimit({
  ...redisStore("payoutOtpSendLimiter"),
  windowMs: 60 * 60 * 1000, limit: 6,
  keyGenerator: (req) => `payotp:${req.user._id}`,
  message: { error: "Too many codes requested. Try again later." },
  standardHeaders: true, legacyHeaders: false,
});
// Wrong password / wrong OTP / validation failures count; successes do not.
export const payoutVerifyLimiter = rateLimit({
  ...redisStore("payoutVerifyLimiter"),
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: (req) => `payverify:${req.user._id}`,
  message: { error: "Too many failed attempts. Try again in 15 minutes." },
  standardHeaders: true, legacyHeaders: false,
});

// ---------- Email change (per user + per IP; run AFTER requireAuth) ----------
// Layer 1: per network.
export const emailChangeIpLimiter = rateLimit({
  ...redisStore("emailChangeIpLimiter"),
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Layer 2: per account, codes actually sent. Failed requests (wrong password,
// cooldown) are skipped — emailChangeFailLimiter already caps those.
export const emailChangeSendLimiter = rateLimit({
  ...redisStore("emailChangeSendLimiter"),
  windowMs: 60 * 60 * 1000,
  limit: 6,
  skipFailedRequests: true,
  keyGenerator: (req) => `emchg:send:${req.user._id}`,
  message: { error: "Too many codes requested. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Wrong password / wrong code / validation failures count; successes do not.
export const emailChangeFailLimiter = rateLimit({
  ...redisStore("emailChangeFailLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `emchg:fail:${req.user._id}`,
  message: { error: "Too many failed attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Admin re-authentication for destructive actions ----------
export const adminReauthLimiter = rateLimit({
  ...redisStore("adminReauthLimiter"),
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `adminreauth:${req.user._id}`,
  message: { error: "Too many failed attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Geocoding proxy (public form => keyed by network) ----------
export const geocodeIpLimiter = rateLimit({
  ...redisStore("geocodeIpLimiter"),
  windowMs: 60 * 1000,
  limit: 40,
  message: { error: "Too many searches, please slow down", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
});
