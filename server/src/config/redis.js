import { createClient } from "redis";


import { logError } from "../utils/logger.js";
const redisClient = createClient({
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    },
    // If Redis is disconnected, fail commands IMMEDIATELY instead of queuing
    // them. Without this, an outage makes every cached-endpoint request hang
    // for the full Redis reconnect timeout (up to 8+ seconds in testing).
    disableOfflineQueue: true,
});


redisClient.on("error", (err) => {
  logError("Redis Error:", err);
});

export async function connectRedis() {
  await redisClient.connect();
  console.log("✅ Redis connected");
}


export default redisClient;
