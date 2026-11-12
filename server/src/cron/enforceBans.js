// server/src/cron/enforceBans.js
import User from "../models/User.js";
import { enforceBan } from "../services/banService.js";

import { logError } from "../utils/logger.js";
export async function runEnforceBans() {
  const pending = await User.find({ isBanned: true, banEnforcedAt: null })
    .select("_id")
    .limit(50)
    .lean();

  for (const u of pending) {
    try {
      await enforceBan(u._id);
    } catch (err) {
      logError(`enforceBan failed for ${u._id}:`, err);
    }
  }
  return pending.length;
}