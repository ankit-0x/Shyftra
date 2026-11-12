// server/src/controllers/emailChangeController.js
import { z } from "zod";
import { HttpError } from "../utils/HttpError.js";
import { sendMailSafely } from "../utils/mailer.js";
import { emailChangedNoticeTemplate } from "../utils/emailTemplates.js";
import { logSecurityEvent } from "../utils/securityAudit.js";
import { disconnectUserSockets, blacklistCookieTokens } from "../utils/sessions.js";
import {
  generateAccessToken,
  generateRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "../utils/tokens.js";
import {
  requestEmailChange,
  resendEmailChangeOtp,
  verifyEmailChange,
  maskEmail,
} from "../services/emailChangeService.js";

import { logError } from "../utils/logger.js";
const requestSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { message: "That email address is too long" })
    .email({ message: "Please enter a valid email address" }),
  currentPassword: z
    .string()
    .min(1, { message: "Enter your current password" })
    .max(128, { message: "Password is too long" }),
});

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: "Enter the 6-digit code" }),
});

// Maps HttpError (with .code/.retryAfter/.attemptsLeft) to the JSON shape the
// client expects. NOTE: a wrong password is a 400 on purpose — the axios
// interceptor treats 401 as "session expired" and would log the user out.
function sendFlowError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    const body = { error: err.message, code: err.code ?? null };
    if (err.retryAfter != null) {
      body.retryAfter = err.retryAfter;
      res.set("Retry-After", String(err.retryAfter));
    }
    if (err.attemptsLeft != null) body.attemptsLeft = err.attemptsLeft;
    return res.status(err.status).json(body);
  }
  logError(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage, code: "SERVER" });
}

// POST /api/auth/change-email/request   { newEmail, currentPassword }
export async function requestEmailChangeHandler(req, res) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  try {
    const result = await requestEmailChange(req.user._id, parsed.data);
    await logSecurityEvent(req, req.user._id, "email_change_requested", { to: maskEmail(parsed.data.newEmail) });
    res.json(result);
  } catch (err) {
    if (err.code === "WRONG_CURRENT_PASSWORD") {
      await logSecurityEvent(req, req.user._id, "email_change_failed", { reason: "wrong_password" });
    }
    sendFlowError(res, err, "Could not start the email change");
  }
}

// POST /api/auth/change-email/resend   (no body)
export async function resendEmailChangeHandler(req, res) {
  try {
    res.json(await resendEmailChangeOtp(req.user._id));
  } catch (err) {
    sendFlowError(res, err, "Could not resend the code");
  }
}

// POST /api/auth/change-email/verify   { code }
export async function verifyEmailChangeHandler(req, res) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "OTP_INVALID" });
  }
  try {
    const { user, oldEmail, newEmail } = await verifyEmailChange(req.user._id, parsed.data);

    // Same session handling as change-password: this browser's old tokens die
    // (race window), then it gets fresh ones carrying the new tokenVersion.
    await blacklistCookieTokens(req.cookies);
    res.cookie("accessToken", generateAccessToken(user), accessCookieOptions);
    res.cookie("refreshToken", generateRefreshToken(user), refreshCookieOptions);
    await disconnectUserSockets(user._id);

    await logSecurityEvent(req, user._id, "email_changed", { from: maskEmail(oldEmail), to: maskEmail(newEmail) });

    // Tell the OLD mailbox. If it wasn't the owner who did this, this is their only warning.
    sendMailSafely({
      to: oldEmail,
      ...emailChangedNoticeTemplate({
        name: user.name,
        newEmailMasked: maskEmail(newEmail),
        supportEmail: process.env.SUPPORT_EMAIL || "",
      }),
    });

    res.json({
      message: "Email updated. Your other devices have been logged out.",
      email: newEmail,
      otherSessionsRevoked: true,
    });
  } catch (err) {
    if (err.code?.startsWith?.("OTP_")) {
      await logSecurityEvent(req, req.user._id, "email_change_failed", { code: err.code });
    }
    sendFlowError(res, err, "Could not change your email");
  }
}