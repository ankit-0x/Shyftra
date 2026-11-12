// server/src/utils/sessions.js
import jwt from "jsonwebtoken";
import redisClient from "../config/redis.js";

import { logError } from "./logger.js";
// Kick every live socket of this user (called after password change/reset).
export async function disconnectUserSockets(userId) {
  try {
    const { getIO } = await import("../config/socket.js");
    getIO().in(`user:${userId}`).disconnectSockets(true);
  } catch (err) {
    logError("disconnectUserSockets failed:", err);
  }
}

// Put this browser's current tokens on the Redis blacklist until they expire.
export async function blacklistCookieTokens(cookies = {}) {
  const candidates = [
    { token: cookies.accessToken, secret: process.env.JWT_ACCESS_SECRET },
    { token: cookies.refreshToken, secret: process.env.JWT_REFRESH_SECRET },
  ];
  for (const { token, secret } of candidates) {
    if (!token) continue;
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redisClient.setEx(`blacklist:${token}`, ttl, "1").catch(() => {});
    } catch {
      /* already invalid */
    }
  }
}
