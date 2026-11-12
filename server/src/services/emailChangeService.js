// server/src/services/emailChangeService.js
// Email change with a 6-digit code sent to the NEW address.
// Same building blocks as services/payoutVerification.js (hash-only storage,
// atomic attempt counter, single-use consume) so the two flows behave alike.
import crypto from "crypto";
import User from "../models/User.js";
import { HttpError } from "../utils/HttpError.js";
import { createNumericOtp, hashToken, safeEqualHex } from "../utils/secureTokens.js";
import { sendMailSafely } from "../utils/mailer.js";
import {
  emailChangeOtpTemplate,
  emailInUseNoticeTemplate,
} from "../utils/emailTemplates.js";
import { verifyCurrentPassword } from "./payoutVerification.js";

export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between codes
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

const CLIENT = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

// Everything that makes a pending change "live". emailChangeOtpSentAt is kept on
// purpose: it powers the resend cooldown even after a clear.
export const CLEAR_EMAIL_CHANGE = {
  pendingEmail: null,
  emailChangeOtpHash: null,
  emailChangeOtpExpires: null,
  emailChangeOtpAttempts: 0,
};

// The hash is bound to user + purpose + the exact NEW address. A code issued for
// a@x.com can never be replayed to confirm b@x.com.
function otpHash(userId, newEmail, code) {
  return hashToken(`${userId}:email_change:${newEmail}:${code}`);
}

function flowError(status, code, message, extra = {}) {
  const e = new HttpError(status, message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

// j***@gmail.com  — enough for the real owner to recognise it, useless to a stranger.
export function maskEmail(email) {
  const [local = "", domain = ""] = String(email).split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

// Generates + stores a code, then mails it. The reply to the caller is IDENTICAL
// whether or not newEmail already belongs to somebody (no account enumeration):
//   - free address   -> real hash stored, code mailed to the new address
//   - taken address  -> a random hash that can never match is stored (so verify
//                       behaves the same), and the existing owner gets a heads-up
async function issueOtp(user, newEmail) {
  const sinceLast = Date.now() - (user.emailChangeOtpSentAt?.getTime() ?? 0);
  if (sinceLast < EMAIL_OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000);
    throw flowError(429, "OTP_COOLDOWN", `Please wait ${retryAfter}s before requesting another code`, { retryAfter });
  }

  const existing = await User.findOne({ email: newEmail }).select("name email emailVerified");
  const taken = !!existing;
  const code = createNumericOtp();

  await User.updateOne(
    { _id: user._id },
    {
      pendingEmail: newEmail,
      emailChangeOtpHash: taken ? hashToken(crypto.randomBytes(32).toString("hex")) : otpHash(user._id, newEmail, code),
      emailChangeOtpExpires: new Date(Date.now() + EMAIL_OTP_TTL_MS),
      emailChangeOtpAttempts: 0,
      emailChangeOtpSentAt: new Date(),
    },
  );

  // Fire-and-forget in BOTH branches so response time does not reveal which one ran.
  if (!taken) {
    sendMailSafely({
      to: newEmail,
      ...emailChangeOtpTemplate({ name: user.name, code, minutes: EMAIL_OTP_TTL_MS / 60000 }),
    });
  } else if (existing.emailVerified) {
    sendMailSafely({
      to: existing.email,
      ...emailInUseNoticeTemplate({ name: existing.name, resetUrl: `${CLIENT()}/forgot-password` }),
    });
  }

  return {
    message: "If this address can be used, a 6-digit code is on its way to it.",
    expiresInSeconds: EMAIL_OTP_TTL_MS / 1000,
    resendInSeconds: EMAIL_OTP_RESEND_COOLDOWN_MS / 1000,
  };
}

// Step 1: re-authenticate with the current password, then send the code.
export async function requestEmailChange(userId, { newEmail, currentPassword }) {
  if (!(await verifyCurrentPassword(userId, currentPassword))) {
    throw flowError(400, "WRONG_CURRENT_PASSWORD", "Current password is incorrect");
  }
  const user = await User.findById(userId).select("name email emailChangeOtpSentAt");
  if (!user) throw new HttpError(404, "User not found");
  if (user.email === newEmail) {
    throw flowError(400, "SAME_EMAIL", "That is already your email address");
  }
  return issueOtp(user, newEmail);
}

// Re-sends to the address already waiting in pendingEmail (no password needed:
// the flow was already authenticated in step 1, and the cooldown + limiters apply).
export async function resendEmailChangeOtp(userId) {
  const user = await User.findById(userId).select("name email emailChangeOtpSentAt +pendingEmail +emailChangeOtpExpires");
  if (!user) throw new HttpError(404, "User not found");
  if (!user.pendingEmail || !user.emailChangeOtpExpires || user.emailChangeOtpExpires < new Date()) {
    throw flowError(400, "OTP_NOT_REQUESTED", "No active request. Start again with your new email.");
  }
  return issueOtp(user, user.pendingEmail);
}

// Step 2: verify + consume the code, then swap the email. Throws HttpError (with .code).
export async function verifyEmailChange(userId, { code }) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw flowError(400, "OTP_INVALID", "Enter the 6-digit code");
  }

  // Count this attempt BEFORE comparing. The $lt filter is part of the update, so
  // parallel guesses can never exceed EMAIL_OTP_MAX_ATTEMPTS.
  const row = await User.findOneAndUpdate(
    { _id: userId, emailChangeOtpHash: { $ne: null }, emailChangeOtpAttempts: { $lt: EMAIL_OTP_MAX_ATTEMPTS } },
    { $inc: { emailChangeOtpAttempts: 1 } },
    { returnDocument: "after" },
  ).select("email +pendingEmail +emailChangeOtpHash +emailChangeOtpExpires +emailChangeOtpAttempts");

  if (!row) {
    const cur = await User.findById(userId).select("+emailChangeOtpHash +emailChangeOtpAttempts");
    if (cur?.emailChangeOtpHash && cur.emailChangeOtpAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await User.updateOne({ _id: userId }, CLEAR_EMAIL_CHANGE);
      throw flowError(429, "OTP_LOCKED", "Too many wrong codes. Request a new code.");
    }
    throw flowError(400, "OTP_NOT_REQUESTED", "No active code. Start again with your new email.");
  }

  if (row.emailChangeOtpExpires < new Date()) {
    await User.updateOne({ _id: userId }, CLEAR_EMAIL_CHANGE);
    throw flowError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
  }

  const matches = safeEqualHex(otpHash(userId, row.pendingEmail, code), row.emailChangeOtpHash);
  if (!matches) {
    const left = EMAIL_OTP_MAX_ATTEMPTS - row.emailChangeOtpAttempts;
    if (left <= 0) {
      await User.updateOne({ _id: userId }, CLEAR_EMAIL_CHANGE);
      throw flowError(429, "OTP_LOCKED", "Too many wrong codes. Request a new code.");
    }
    throw flowError(400, "OTP_INVALID", `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`, { attemptsLeft: left });
  }

  // Single-use: only ONE concurrent caller can match on the unchanged hash and flip
  // it to null. The same write swaps the address and revokes every old session.
  const oldEmail = row.email;
  const newEmail = row.pendingEmail;
  let updated;
  try {
    updated = await User.findOneAndUpdate(
      { _id: userId, emailChangeOtpHash: row.emailChangeOtpHash },
      {
        $set: {
          email: newEmail,
          emailVerified: true, // the code proved the new mailbox is theirs
          emailVerifiedAt: new Date(),
          // Links already mailed to the OLD address must die with it.
          passwordResetTokenHash: null,
          passwordResetExpires: null,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null,
          ...CLEAR_EMAIL_CHANGE,
        },
        $inc: { tokenVersion: 1 }, // log out every other device (same idea as change-password)
      },
      { returnDocument: "after" },
    );
  } catch (err) {
    if (err?.code === 11000) {
      // Someone else claimed the address between "send code" and "verify".
      await User.updateOne({ _id: userId }, CLEAR_EMAIL_CHANGE);
      throw flowError(409, "EMAIL_CHANGE_CONFLICT", "We couldn't complete this change. Please start again with a different address.");
    }
    throw err;
  }
  if (!updated) throw flowError(400, "OTP_ALREADY_USED", "This code was already used. Request a new one.");

  return { user: updated, oldEmail, newEmail };
}