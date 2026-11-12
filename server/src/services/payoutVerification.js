// server/src/services/payoutVerification.js
// Email-OTP helper for cashouts + password re-auth for payout-method changes.
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { HttpError } from "../utils/HttpError.js";
import { createNumericOtp, hashToken, safeEqualHex } from "../utils/secureTokens.js";
import { sendMail } from "../utils/mailer.js";
import { payoutOtpTemplate } from "../utils/emailTemplates.js";

import { logError } from "../utils/logger.js";
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const PAYOUT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// The hash is bound to user + purpose + context (the amount). An OTP issued for
// ₹100 therefore cannot be replayed to withdraw ₹10,000.
function otpHash(userId, purpose, context, code) {
  return hashToken(`${userId}:${purpose}:${context}:${code}`);
}

export const CLEAR_PAYOUT_OTP = {
  payoutOtpHash: null,
  payoutOtpExpires: null,
  payoutOtpPurpose: null,
  payoutOtpAttempts: 0,
};

export async function sendPayoutOtp(userId, { purpose, context }) {
  const user = await User.findById(userId).select("name email payoutOtpSentAt");
  if (!user) throw new HttpError(404, "User not found");

  const sinceLast = Date.now() - (user.payoutOtpSentAt?.getTime() ?? 0);
  if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000);
    const err = new HttpError(429, `Please wait ${retryAfter}s before requesting another code`);
    err.code = "OTP_COOLDOWN";
    err.retryAfter = retryAfter;
    throw err;
  }

  const code = createNumericOtp();
  await User.updateOne(
    { _id: userId },
    {
      payoutOtpHash: otpHash(userId, purpose, context, code),
      payoutOtpExpires: new Date(Date.now() + OTP_TTL_MS),
      payoutOtpPurpose: purpose,
      payoutOtpAttempts: 0,
      payoutOtpSentAt: new Date(),
    },
  );

  try {
    await sendMail({
      to: user.email,
      ...payoutOtpTemplate({
        name: user.name,
        code,
        purposeText: purpose === "cashout" ? `your withdrawal of ₹${Number(context) / 100}` : "this action",
        minutes: OTP_TTL_MS / 60000,
      }),
    });
  } catch (err) {
    await User.updateOne({ _id: userId }, CLEAR_PAYOUT_OTP);
    logError("payout OTP email failed:", err);
    const e = new HttpError(502, "Could not send the code. Please try again.");
    e.code = "OTP_EMAIL_FAILED";
    throw e;
  }
  return { expiresInSeconds: OTP_TTL_MS / 1000, resendInSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
}

function otpError(status, code, message, extra = {}) {
  const e = new HttpError(status, message);
  e.code = code;
  Object.assign(e, extra);
  return e;
}

// Verifies AND consumes the OTP. Throws HttpError (with .code) on any failure.
export async function verifyAndConsumePayoutOtp(userId, { purpose, context, code }) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw otpError(400, "OTP_INVALID", "Enter the 6-digit code");
  }

  // Step 1: atomically count this attempt BEFORE comparing. Parallel guesses
  // can never exceed OTP_MAX_ATTEMPTS because the $lt filter is part of the update.
  const row = await User.findOneAndUpdate(
    { _id: userId, payoutOtpHash: { $ne: null }, payoutOtpAttempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { payoutOtpAttempts: 1 } },
    { returnDocument: "after" },
  ).select("+payoutOtpHash +payoutOtpExpires +payoutOtpPurpose +payoutOtpAttempts");

  if (!row) {
    const cur = await User.findById(userId).select("+payoutOtpHash +payoutOtpAttempts");
    if (cur?.payoutOtpHash && cur.payoutOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await User.updateOne({ _id: userId }, CLEAR_PAYOUT_OTP);
      throw otpError(429, "OTP_LOCKED", "Too many wrong codes. Request a new code.");
    }
    throw otpError(400, "OTP_NOT_REQUESTED", "No active code. Request a new one.");
  }

  if (row.payoutOtpExpires < new Date()) {
    await User.updateOne({ _id: userId }, CLEAR_PAYOUT_OTP);
    throw otpError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
  }

  const expected = otpHash(userId, purpose, context, code);
  const matches = row.payoutOtpPurpose === purpose && safeEqualHex(expected, row.payoutOtpHash);
  if (!matches) {
    const left = OTP_MAX_ATTEMPTS - row.payoutOtpAttempts;
    if (left <= 0) {
      await User.updateOne({ _id: userId }, CLEAR_PAYOUT_OTP);
      throw otpError(429, "OTP_LOCKED", "Too many wrong codes. Request a new code.");
    }
    throw otpError(400, "OTP_INVALID", `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`, { attemptsLeft: left });
  }

  // Step 2: single-use. Only ONE concurrent caller can flip the hash to null.
  const consumed = await User.findOneAndUpdate(
    { _id: userId, payoutOtpHash: row.payoutOtpHash },
    { ...CLEAR_PAYOUT_OTP, lastPayoutVerifiedAt: new Date() },
  );
  if (!consumed) throw otpError(400, "OTP_ALREADY_USED", "This code was already used. Request a new one.");
}

// Password re-authentication for sensitive actions.
export async function verifyCurrentPassword(userId, password) {
  if (typeof password !== "string" || !password || password.length > 128) return false;
  const u = await User.findById(userId).select("+password");
  return !!u && (await bcrypt.compare(password, u.password));
}

export function maskVpa(vpa) {
  const [name, handle] = String(vpa).split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 2))}@${handle}`;
}
export function maskAccount(acc) {
  return `•••• ${String(acc).slice(-4)}`;
}
