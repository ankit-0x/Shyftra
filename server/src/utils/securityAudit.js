// server/src/utils/securityAudit.js
import SecurityEvent from "../models/SecurityEvent.js";

import { logError } from "./logger.js";
// Best-effort, same philosophy as utils/audit.js: an audit failure must not
// break the user's action.
export async function logSecurityEvent(req, userId, type, meta = {}) {
  try {
    await SecurityEvent.create({
      user: userId,
      type,
      ip: req?.ip,
      userAgent: req?.get?.("user-agent")?.slice(0, 200),
      meta,
    });
  } catch (err) {
    logError("security audit failed:", err);
  }
}
