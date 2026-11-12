// server/src/middleware/redisRateLimitStore.js
// Redis-backed store for express-rate-limit v8. No extra npm package needed.
//
// - Each limiter gets its own key prefix, so two limiters that key by the same
//   user id never share a counter.
// - If Redis is down or slow, the limiter FAILS OPEN quickly (the request is
//   allowed, an error is logged) instead of hanging. node-redis queues commands
//   while disconnected, so without the timeout below every limited request would
//   wait for Redis to come back. After one timeout a short circuit breaker skips
//   Redis entirely, so an outage costs one 500 ms delay, not 500 ms per request.

const STORE_TIMEOUT_MS = 500;
const BREAKER_MS = 5_000;
let breakerOpenUntil = 0; // shared by every limiter

function guarded(run) {
  if (Date.now() < breakerOpenUntil) {
    return Promise.reject(new Error("rate-limit store unavailable (circuit open)"));
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      breakerOpenUntil = Date.now() + BREAKER_MS;
      reject(new Error("rate-limit store timeout"));
    }, STORE_TIMEOUT_MS);
  });
  return Promise.race([run(), timeout]).finally(() => clearTimeout(timer));
}

export class RedisRateLimitStore {
  constructor({ client, prefix }) {
    this.client = client;
    this.prefix = `rl:${prefix}:`;
    this.windowMs = 60_000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  k(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    const k = this.k(key);
    const [hits, ttl] = await guarded(() => this.client.multi().incr(k).pTTL(k).exec());
    let pttl = Number(ttl);
    // No expiry yet (first hit, or a crash between INCR and PEXPIRE): repair it now.
    if (!(pttl > 0)) {
      await guarded(() => this.client.pExpire(k, this.windowMs));
      pttl = this.windowMs;
    }
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + pttl) };
  }

  async decrement(key) {
    const k = this.k(key);
    const v = await guarded(() => this.client.decr(k));
    if (v <= 0) await guarded(() => this.client.del(k));
  }

  async resetKey(key) {
    await guarded(() => this.client.del(this.k(key)));
  }
}
