// server/src/cron/index.js
import cron from "node-cron";
import redisClient from "../config/redis.js";
import { runAutoCloseShifts } from "./autoCloseShifts.js";
import {
  runAutoFinalizePendingResolutions,
  runAutoRuleDisputes,
} from "./autoResolveDisputes.js";
import {
  runExpireUnstartedApplications,
  runExpireStaleShifts,
  runRecomputeStuckShifts,
} from "./expireStaleWork.js";
import { runEnforceBans } from "./enforceBans.js";
import { runReconcilePayouts } from "./reconcilePayouts.js";
import { runLedgerCheck } from "../services/ledgerService.js";

import { logError } from "../utils/logger.js";
const tasks = [];
const running = new Set();

async function withLock(lockKey, ttlSeconds, fn) {
  try {
    const result = await redisClient.set(lockKey, "1", {
      NX: true,
      EX: ttlSeconds,
    });
    if (result !== "OK") return;
  } catch (err) {
    logError(`cron ${lockKey}: lock failed, skipping tick`, err);
    return;
  }

  const job = Promise.resolve()
    .then(fn)
    .catch((err) => logError(`cron ${lockKey} failed:`, err));
  running.add(job);
  try {
    await job;
  } finally {
    running.delete(job);
  }
}

export function startCronJobs() {
  const HOURLY_TTL = 55 * 60;

  // ✅ FIX: Sequential execution — prevents WriteConflict storms between
  // autoClose and expireUnstarted when both touch the same shift. Also makes
  // the ordering deterministic: autoClose settles clocked-in workers FIRST,
  // so expireUnstarted sees completedCount > 0 and never wrongly expires.
  tasks.push(
    cron.schedule("0 * * * *", async () => {
      await withLock("cron:autoCloseShifts", HOURLY_TTL, runAutoCloseShifts);
      await withLock(
        "cron:expireUnstartedApplications",
        HOURLY_TTL,
        runExpireUnstartedApplications,
      );
      await withLock(
        "cron:expireStaleShifts",
        HOURLY_TTL,
        runExpireStaleShifts,
      );
      await withLock(
        "cron:recomputeStuckShifts",
        HOURLY_TTL,
        runRecomputeStuckShifts,
      );
      await withLock(
        "cron:autoFinalizePendingResolutions",
        HOURLY_TTL,
        runAutoFinalizePendingResolutions,
      );
      await withLock("cron:autoRuleDisputes", HOURLY_TTL, runAutoRuleDisputes);
    }),
  );

  tasks.push(
    cron.schedule("*/5 * * * *", () => {
      withLock("cron:enforceBans", 4 * 60, runEnforceBans);
    }),
  );

  tasks.push(
    cron.schedule("*/30 * * * *", () => {
      withLock("cron:reconcilePayouts", 25 * 60, runReconcilePayouts);
    }),
  );

  tasks.push(
    cron.schedule(
      "0 3 * * *",
      () => {
        withLock("cron:ledgerCheck", 23 * 60 * 60, runLedgerCheck);
      },
      { timezone: "Asia/Kolkata" },
    ),
  );

  console.log("✅ Cron jobs scheduled");
}

export function stopCronJobs() {
  for (const task of tasks) task.stop();
}

export async function waitForCronJobs(timeoutMs) {
  if (running.size === 0) return;
  await Promise.race([
    Promise.allSettled([...running]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
