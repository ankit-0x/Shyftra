// server/src/utils/tokens.js
import jwt from "jsonwebtoken";

export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      tv: user.tokenVersion ?? 0,   // 🆕 token version claim
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      tv: user.tokenVersion ?? 0,   // 🆕 token version claim
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

const isProd = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  ...accessCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};