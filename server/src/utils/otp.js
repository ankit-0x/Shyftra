// server/src/utils/otp.js
import redisClient from "../config/redis.js";
import crypto from "crypto";

const OTP_TTL_SECONDS = 15 * 60; // 15 minutes

export async function createOtp(shiftId, workerId, purpose = "entry") {
  const code = crypto.randomInt(100000, 1000000).toString();  // 6-digit CSPRNG
  await redisClient.setEx(`otp:${purpose}:${shiftId}:${workerId}`, OTP_TTL_SECONDS, code);
  await redisClient.del(`otpfail:${purpose}:${shiftId}:${workerId}`); // fresh code, fresh attempts
  return code;
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function verifyAndConsumeOtp(shiftId, workerId, submittedCode, purpose = "entry") {
  const key = `otp:${purpose}:${shiftId}:${workerId}`;
  const failKey = `otpfail:${purpose}:${shiftId}:${workerId}`;

  // Count the attempt FIRST (atomic INCR). The old read-then-increment let a
  // burst of parallel guesses all pass the "fewer than 5 failures" check.
  const attempts = await redisClient.incr(failKey);
  if (attempts === 1) await redisClient.expire(failKey, OTP_TTL_SECONDS);
  if (attempts > 5) {
    await redisClient.del(key);        // too many guesses, kill the code
    return false;
  }

  const storedCode = await redisClient.get(key);
  if (!storedCode || !safeEqual(storedCode, submittedCode)) return false;

  const deleted = await redisClient.del(key); // atomic: only one caller gets 1
  if (deleted !== 1) return false;
  await redisClient.del(failKey);
  return true;
}