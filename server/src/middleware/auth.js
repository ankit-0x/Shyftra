// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import redisClient from "../config/redis.js";

import { logError } from "../utils/logger.js";
// Shared helper: given a raw token string, returns the matching User
// document, or null if the token is missing/invalid/blacklisted/expired.
async function resolveUserFromToken(token) {
  if (!token) return null;

  // 🆕 M1 fix: fail CLOSED if Redis is down. If we can't verify the
  // blacklist, we treat the token as revoked. Better to reject a valid
  // request than to accept a logged-out one.
  try {
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) return null;
  } catch (err) {
    logError("auth: redis blacklist check failed", err);
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],   // 🆕 L1 fix: pin the algorithm
    });

    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive || user.isBanned) return null;
    if (user.emailVerified === false) return null; // unverified emails never get a session

    // 🆕 Session revocation check.
    // Existing tokens (issued before this feature) have no `tv` claim.
    // Treat them as tv = 0 so they still work for users whose version is 0.
    const tokenVersion = decoded.tv ?? 0;
    const userVersion = user.tokenVersion ?? 0;
    if (tokenVersion !== userVersion) return null;

    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const user = await resolveUserFromToken(req.cookies.accessToken);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = user;
  next();
}

export async function optionalAuth(req, res, next) {
  req.user = await resolveUserFromToken(req.cookies.accessToken);
  next();
}