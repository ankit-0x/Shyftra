// server/src/controllers/authController.js
import { z } from "zod";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import redisClient from "../config/redis.js";
import Worker from "../models/Worker.js";
import Employer from "../models/Employer.js";
import {
  generateAccessToken,
  generateRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "../utils/tokens.js";
import { passwordSchema } from "../utils/passwordSchema.js";
import { createUrlToken, hashToken } from "../utils/secureTokens.js";
import { sendMail, sendMailSafely } from "../utils/mailer.js";
import {
  verifyEmailTemplate,
  alreadyRegisteredTemplate,
  resetPasswordTemplate,
  passwordChangedTemplate,
} from "../utils/emailTemplates.js";
import { logSecurityEvent } from "../utils/securityAudit.js";
import {
  disconnectUserSockets,
  blacklistCookieTokens,
} from "../utils/sessions.js";
import { CLEAR_PAYOUT_OTP } from "../services/payoutVerification.js";

import { logError } from "../utils/logger.js";
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 20;
const CLIENT = () =>
  (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

// Pre-computed hash so a login for a NON-existing email costs the same time
// as a real one (stops timing-based email enumeration).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Strips out the password (and anything else private) before sending a
// user object back to the browser. NEVER send the raw Mongoose user object.
function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified !== false,
    verificationStatus: user.verificationStatus,
    isVerified: user.verificationStatus === "verified", // keeps old frontend code working
    avatarUrl: user.avatarUrl,
    walletBalance: user.walletBalance,
    strikes: user.strikes, // NEW: Needed for strike-warning UI
    isBanned: user.isBanned, // NEW: Needed for ban-messaging UI
    banReason: user.banReason,
    freeShiftsUsed: user.freeShiftsUsed ?? 0, // ✅ NEW: for freebie counter UI
  };
}

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "Name must be at least 3 characters long" })
    .max(50, { message: "Name cannot exceed 50 characters" })
    .regex(/^[a-zA-Z\s\-']+$/, {
      message:
        "Name can only contain letters, spaces, hyphens, and apostrophes",
    }),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please enter a valid email address" }),

  password: passwordSchema, // shared rule (utils/passwordSchema.js)

  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, {
      message:
        "Phone must be a valid international number (e.g. +919876543210)",
    }),

  // zod v4 uses `error:` (the old `errorMap:` option was removed and is silently ignored)
  role: z.enum(["worker", "employer"], {
    error: "Role must be either 'worker' or 'employer'",
  }),
});

// Creates the verification token on a user document (hash only is stored).
function issueVerificationToken(user) {
  const { raw, hash } = createUrlToken();
  user.emailVerificationTokenHash = hash;
  user.emailVerificationExpires = new Date(
    Date.now() + VERIFY_TTL_HOURS * 3600 * 1000,
  );
  return raw;
}

async function sendVerificationEmail(user, rawToken) {
  const url = `${CLIENT()}/verify-email/${rawToken}`;
  await sendMail({
    to: user.email,
    ...verifyEmailTemplate({ name: user.name, url, hours: VERIFY_TTL_HOURS }),
  });
}

const REGISTER_RESPONSE = (email) => ({
  requiresEmailVerification: true,
  email,
  message:
    "If this email can be registered, a verification link is on its way.",
});

export async function registerUser(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        error: parsed.error.issues[0]?.message || "Invalid registration data",
      });
  }
  const { name, email, password, phone, role } = parsed.data;

  const existing = await User.findOne({ email }).select(
    "+emailVerificationTokenHash",
  );

  // CASE A: verified account already exists. Same response as a fresh signup
  // (no enumeration) + a heads-up email to the real owner.
  if (existing?.emailVerified) {
    sendMailSafely({
      to: existing.email,
      ...alreadyRegisteredTemplate({
        name: existing.name,
        loginUrl: `${CLIENT()}/`,
        resetUrl: `${CLIENT()}/forgot-password`,
      }),
    });
    return res.status(201).json(REGISTER_RESPONSE(email));
  }

  const session = await mongoose.startSession();
  let user;
  let rawToken;
  try {
    await session.withTransaction(async () => {
      if (existing) {
        // CASE B: unverified account exists ("re-register before verifying").
        // LATEST SUBMISSION WINS: overwrite name/phone/password/role. This blocks
        // "pre-hijacking" (an attacker registering your email first with their
        // password): when the real owner signs up, the attacker's password is gone,
        // and only the mailbox owner can click the new link.
        user = await User.findById(existing._id)
          .select(
            "+password +emailVerificationTokenHash +emailVerificationExpires",
          )
          .session(session);
        const roleChanged = user.role !== role;
        user.name = name;
        user.phone = phone;
        user.password = password; // pre-save hook re-hashes
        user.role = role;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        rawToken = issueVerificationToken(user);
        await user.save({ session });
        if (roleChanged) {
          await Worker.deleteOne({ user: user._id }, { session });
          await Employer.deleteOne({ user: user._id }, { session });
          if (role === "worker") {
            await Worker.create(
              [
                {
                  user: user._id,
                  skills: [],
                  location: { type: "Point", coordinates: [0, 0] },
                },
              ],
              { session },
            );
          } else {
            await Employer.create(
              [{ user: user._id, businessName: user.name }],
              { session },
            );
          }
        }
        return;
      }

      // CASE C: brand-new user.
      user = new User({
        name,
        email,
        password,
        phone,
        role,
        emailVerified: false,
      });
      rawToken = issueVerificationToken(user);
      await user.save({ session });
      if (role === "worker") {
        await Worker.create(
          [
            {
              user: user._id,
              skills: [],
              location: { type: "Point", coordinates: [0, 0] },
            },
          ],
          { session },
        );
      } else {
        await Employer.create([{ user: user._id, businessName: user.name }], {
          session,
        });
      }
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(201).json(REGISTER_RESPONSE(email)); // race: someone just created it
    throw err;
  } finally {
    session.endSession();
  }

  // The account exists even if SMTP hiccups; the user can press "Resend".
  try {
    await sendVerificationEmail(user, rawToken);
  } catch (err) {
    logError("verification email failed:", err);
  }

  // NO cookies here: the user must verify the email first.
  res.status(201).json(REGISTER_RESPONSE(email));
}

// POST /api/auth/verify-email/:token
// POST (not GET) on purpose: mail scanners & link-preview bots pre-fetch GET
// links and would silently burn the token. The React page calls this on mount.
export async function verifyEmail(req, res) {
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res
      .status(400)
      .json({
        error: "This verification link is invalid",
        code: "TOKEN_INVALID",
      });
  }
  const hash = hashToken(token);

  // Atomic claim: valid hash + not yet verified + not expired, all in ONE write.
  const claimed = await User.findOneAndUpdate(
    {
      emailVerificationTokenHash: hash,
      emailVerified: false,
      emailVerificationExpires: { $gt: new Date() },
    },
    {
      $set: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationExpires: null,
      },
    },
    { returnDocument: "after" },
  );
  if (claimed) {
    await logSecurityEvent(req, claimed._id, "email_verified");
    return res.json({
      verified: true,
      status: "verified",
      message: "Email verified. You can log in now.",
    });
  }

  // Not claimed: figure out WHY so the UI can say something useful.
  const user = await User.findOne({ emailVerificationTokenHash: hash }).select(
    "emailVerified +emailVerificationExpires",
  );
  if (!user)
    return res
      .status(400)
      .json({
        error: "This verification link is invalid",
        code: "TOKEN_INVALID",
      });
  if (user.emailVerified)
    return res.json({
      verified: true,
      status: "already_verified",
      message: "Email already verified. You can log in.",
    });
  return res
    .status(410)
    .json({
      error: "This verification link has expired. Request a new one.",
      code: "TOKEN_EXPIRED",
    });
}

// POST /api/auth/resend-verification   body: { email }
// ALWAYS 200 with the same body (no enumeration). Rate limited per IP + per email.
const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export async function resendVerification(req, res) {
  const generic = {
    message: "If that account needs verification, a new link has been sent.",
  };
  const parsed = emailOnlySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Please enter a valid email address" });

  const user = await User.findOne({ email: parsed.data.email }).select(
    "+emailVerificationTokenHash +emailVerificationExpires",
  );
  if (user && user.emailVerified === false && user.isActive && !user.isBanned) {
    const raw = issueVerificationToken(user); // old link stops working
    await user.save();
    sendMailSafely({
      to: user.email,
      ...verifyEmailTemplate({
        name: user.name,
        url: `${CLIENT()}/verify-email/${raw}`,
        hours: VERIFY_TTL_HOURS,
      }),
    });
  }
  res.json(generic);
}

const loginSchema = z.object({
  email: z
    .string()
    .trim() // 1. Remove accidental spaces
    .toLowerCase() // 2. Match the registration format exactly
    .email({ message: "Please enter a valid email address" })
    .min(1, { message: "Email is required" }),

  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(128, { message: "Password is too long" }), // 3. Denial-of-Service (DoS) protection
});

export async function loginUser(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid login data" });
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select("+password");

  // Same error AND same timing whether the email doesn't exist or the password
  // is wrong (bcrypt always runs, against a dummy hash if there is no user).
  const passwordOk = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_HASH,
  );
  if (!user || !passwordOk) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.isActive || user.isBanned) {
    return res
      .status(403)
      .json({
        error: "This account has been deactivated or permanently banned",
      });
  }
  // Only reached with the CORRECT password, so this doesn't leak which emails exist.
  // 403 (not 401) so the axios interceptor doesn't try to "refresh" a login.
  if (user.emailVerified === false) {
    return res.status(403).json({
      error: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  res.json({ user: toSafeUser(user) });
}

export async function logoutUser(req, res) {
  const { accessToken, refreshToken } = req.cookies;

  const candidates = [
    { token: accessToken, secret: process.env.JWT_ACCESS_SECRET },
    { token: refreshToken, secret: process.env.JWT_REFRESH_SECRET },
  ];

  for (const { token, secret } of candidates) {
    if (!token) continue;

    let decoded;
    try {
      // Throws on bad signature, malformed token, or expiry.
      decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch {
      continue; // never touch Redis for tokens we'd reject anyway
    }

    const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds > 0) {
      await redisClient
        .setEx(`blacklist:${token}`, ttlSeconds, "1")
        .catch(() => {});
    }
  }

  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
  res.json({ loggedOut: true });
}

export async function refreshToken(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  // 🆕 Fail closed if Redis is down
  try {
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: "Refresh token has been revoked" });
    }
  } catch (err) {
    logError("refresh: redis blacklist check failed", err);
    return res.status(401).json({ error: "Authentication unavailable" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"], // 🆕 L1 fix
    });
    const user = await User.findById(decoded.userId);
    if (
      !user ||
      !user.isActive ||
      user.isBanned ||
      user.emailVerified === false
    ) {
      return res.status(401).json({ error: "User not found or deactivated" });
    }

    // 🆕 Session revocation check
    const tokenVersion = decoded.tv ?? 0;
    const userVersion = user.tokenVersion ?? 0;
    if (tokenVersion !== userVersion) {
      return res.status(401).json({ error: "Session has been revoked" });
    }

    const newAccessToken = generateAccessToken(user);
    res.cookie("accessToken", newAccessToken, accessCookieOptions);
    res.json({ refreshed: true });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}

export async function getMe(req, res) {
  // Auth state har call pe fresh chahiye — caching off
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("ETag", "");

  if (!req.user) {
    // Agar refreshToken cookie maujood hai, matlab user ka access token
    // expire ho gaya hai (logged out nahi hua). 401 do taaki frontend
    // interceptor refresh call kar sake.
    const hasRefreshToken = !!req.cookies?.refreshToken;

    if (hasRefreshToken) {
      return res.status(401).json({ error: "Access token expired" });
    }

    // Sach mein anonymous visitor hai
    return res.json({ user: null });
  }

  res.json({ user: toSafeUser(req.user) });
}

// 🆕 Log out from all devices — invalidates every token issued so far.
// Since we can't enumerate remote tokens, we bump tokenVersion. Every
// existing access + refresh token carries an older `tv` and will be
// rejected by middleware/auth.js, refreshToken, and the socket handshake.
export async function logoutAllDevices(req, res) {
  try {
    const userId = req.user._id;

    // Step 1: Revoke all tokens by bumping version
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });

    // Step 2: Blacklist the CURRENT device's tokens too, so this device
    // can't sneak a request in with the pre-bump token (race window).
    const { accessToken, refreshToken } = req.cookies;
    const candidates = [
      { token: accessToken, secret: process.env.JWT_ACCESS_SECRET },
      { token: refreshToken, secret: process.env.JWT_REFRESH_SECRET },
    ];
    for (const { token, secret } of candidates) {
      if (!token) continue;
      try {
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
        const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttlSeconds > 0) {
          await redisClient
            .setEx(`blacklist:${token}`, ttlSeconds, "1")
            .catch(() => {});
        }
      } catch {
        // token already invalid — nothing to blacklist
      }
    }

    // Step 3: Disconnect every live socket for this user
    try {
      const { getIO } = await import("../config/socket.js");
      getIO().in(`user:${userId}`).disconnectSockets(true);
    } catch (err) {
      logError("logoutAllDevices: socket disconnect failed:", err);
    }

    // Step 4: Clear cookies on this device
    res.clearCookie("accessToken", accessCookieOptions);
    res.clearCookie("refreshToken", refreshCookieOptions);

    res.json({ loggedOut: true, allDevices: true });
  } catch (err) {
    logError("logoutAllDevices failed:", err);
    res.status(500).json({ error: "Failed to log out from all devices" });
  }
}

// ======================= FORGOT / RESET PASSWORD (Task 3) =======================

// POST /api/auth/forgot-password   body: { email }
export async function forgotPassword(req, res) {
  const generic = {
    message: "If an account exists for that email, a reset link has been sent.",
  };
  const parsed = emailOnlySchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: "Please enter a valid email address" });

  const user = await User.findOne({ email: parsed.data.email }).select(
    "+passwordResetTokenHash +passwordResetExpires",
  );

  // SECURITY: both paths must do similar DB work so response timing
  // doesn't leak which emails exist. Fire-and-forget everything except
  // the initial findOne.
  if (user && user.isActive && !user.isBanned) {
    const { raw, hash } = createUrlToken();
    // Still not awaited (response timing must not depend on whether the
    // account exists), but the email is only sent AFTER the token is saved,
    // so the link in it can never be dead.
    User.updateOne(
      { _id: user._id },
      {
        passwordResetTokenHash: hash,
        passwordResetExpires: new Date(
          Date.now() + RESET_TTL_MINUTES * 60 * 1000,
        ),
      },
    )
      .then(() =>
        sendMailSafely({
          to: user.email,
          ...resetPasswordTemplate({
            name: user.name,
            url: `${CLIENT()}/reset-password/${raw}`,
            minutes: RESET_TTL_MINUTES,
          }),
        }),
      )
      .catch((err) =>
        logError("forgot-password save failed:", err),
      );
  }
  res.json(generic);
}

// POST /api/auth/reset-password/:token   body: { password }
export async function resetPassword(req, res) {
  const token = String(req.params.token || "");
  const pw = passwordSchema.safeParse(req.body?.password);
  if (!pw.success)
    return res
      .status(400)
      .json({ error: pw.error.issues[0].message, code: "WEAK_PASSWORD" });
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res
      .status(400)
      .json({
        error: "This reset link is invalid or has expired",
        code: "TOKEN_INVALID",
      });
  }
  const hash = hashToken(token);

  // Fetch the user + password so we can reject "same as current"
  const existing = await User.findOne({
    passwordResetTokenHash: hash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+password");

  if (!existing) {
    return res
      .status(400)
      .json({
        error: "This reset link is invalid or has expired",
        code: "TOKEN_INVALID",
      });
  }

  // NEW: reject reuse of the current password (defense-in-depth)
  if (await bcrypt.compare(pw.data, existing.password)) {
    return res.status(400).json({
      error: "New password must be different from your current password",
      code: "SAME_PASSWORD",
    });
  }

  const newHash = await bcrypt.hash(pw.data, 10);

  // Atomic, single-use claim + password write + session revocation in ONE update.
  const user = await User.findOneAndUpdate(
    { passwordResetTokenHash: hash, passwordResetExpires: { $gt: new Date() } },
    {
      $set: {
        password: newHash,
        passwordChangedAt: new Date(),
        // Clicking a link we mailed proves mailbox ownership.
        emailVerified: true,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
        ...CLEAR_PAYOUT_OTP,
      },
      $inc: { tokenVersion: 1 }, // every existing JWT now has an old `tv` => 401
    },
    { returnDocument: "after" },
  );
  if (!user)
    return res
      .status(400)
      .json({
        error: "This reset link is invalid or has expired",
        code: "TOKEN_INVALID",
      });

  await disconnectUserSockets(user._id);
  await logSecurityEvent(req, user._id, "password_reset");
  sendMailSafely({
    to: user.email,
    ...passwordChangedTemplate({
      name: user.name,
      loginUrl: `${CLIENT()}/forgot-password`,
    }),
  });

  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
  res.json({
    message: "Password updated. Please log in with your new password.",
  });
}

// ======================= CHANGE PASSWORD (Task 4) =======================

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: passwordSchema,
  confirmNewPassword: z.string(),
});

// PATCH /api/auth/change-password   (requireAuth)
export async function changePassword(req, res) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  const { currentPassword, newPassword, confirmNewPassword } = parsed.data;

  if (newPassword !== confirmNewPassword) {
    return res
      .status(400)
      .json({ error: "New passwords do not match", code: "MISMATCH" });
  }

  const user = await User.findById(req.user._id).select("+password");
  // 400, NOT 401: the browser's axios interceptor treats 401 as "session
  // expired" and would try to refresh / log the user out.
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res
      .status(400)
      .json({
        error: "Current password is incorrect",
        code: "WRONG_CURRENT_PASSWORD",
      });
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return res
      .status(400)
      .json({
        error: "New password must be different from the current one",
        code: "SAME_PASSWORD",
      });
  }

  user.password = newPassword; // pre-save hook hashes it
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // revoke EVERY other session
  Object.assign(user, CLEAR_PAYOUT_OTP);
  await user.save();

  // This browser's old tokens die too (race window), then it gets fresh ones.
  await blacklistCookieTokens(req.cookies);
  res.cookie("accessToken", generateAccessToken(user), accessCookieOptions);
  res.cookie("refreshToken", generateRefreshToken(user), refreshCookieOptions);

  await disconnectUserSockets(user._id);
  await logSecurityEvent(req, user._id, "password_changed");
  sendMailSafely({
    to: user.email,
    ...passwordChangedTemplate({
      name: user.name,
      loginUrl: `${CLIENT()}/forgot-password`,
    }),
  });

  res.json({
    message: "Password changed. Other devices have been logged out.",
    otherSessionsRevoked: true,
  });
}
