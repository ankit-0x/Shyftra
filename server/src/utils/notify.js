// server/src/utils/notify.js
import { getIO } from "../config/socket.js";
import { toClientJson } from "./money.js";

import { logError } from "./logger.js";
// Notifications are best-effort. They must never turn a committed
// operation into an error response.
export function safeEmit(userId, event, payload) {
  try {
    getIO().to(`user:${userId}`).emit(event, toClientJson(payload));
  } catch (err) {
    logError(`emit ${event} failed:`, err);
  }
}

export function broadcastToRole(role, event, payload) {
  try {
    getIO().to(`role:${role}`).emit(event, payload);
  } catch (err) {
    logError(`broadcast ${event} failed:`, err);
  }
}