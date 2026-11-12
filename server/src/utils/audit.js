import AdminAction from "../models/AdminAction.js";

import { logError } from "./logger.js";
// Best-effort: an audit write failing must not undo the admin's action.
export async function logAdminAction(req, action, targetType, targetId, details = {}) {
  try {
    await AdminAction.create({ admin: req.user._id, action, targetType, targetId, details });
  } catch (err) {
    logError("audit log failed:", err);
  }
}