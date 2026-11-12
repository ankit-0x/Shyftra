import "dotenv/config";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

import { startCronJobs, stopCronJobs, waitForCronJobs } from "./cron/index.js";
import { connectDB } from "./config/db.js";
import redisClient, { connectRedis } from "./config/redis.js";
import { initSocket } from "./config/socket.js";
import { ALLOWED_ORIGIN } from "./config/origin.js";
import { requireSameOrigin } from "./middleware/csrf.js";

import shiftsRouter from "./routes/shifts.js";
import workersRouter from "./routes/workers.js";
import authRouter from "./routes/auth.js";
import earningsRouter from "./routes/earnings.js";
import profileRouter from "./routes/profile.js";
import uploadsRouter from "./routes/uploads.js";
import adminRouter from "./routes/admin.js";
import disputesRouter from "./routes/disputes.js";
import walletRouter from "./routes/wallet.js";
import reviewsRouter from "./routes/reviews.js";
import geocodeRouter from "./routes/geocode.js";
import transactionsRouter from "./routes/transactions.js";

import { moneyResponse } from "./middleware/moneyResponse.js";


import { logError } from "./utils/logger.js";
const app = express();
app.set("trust proxy", 1);

let shuttingDown = false;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// Razorpay's webhook needs the RAW body to verify its signature, so this
// must come before express.json().
app.use("/api/wallet/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(cookieParser());
app.use("/api", requireSameOrigin);
app.use((req, _res, next) => {
  req.body ??= {}; // Express 5 leaves body undefined when no JSON was sent
  next();
});

// Health: 200 only if we can actually serve. Point Render's health check here.
app.get("/api/health", (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: "shutting_down" });
  const checks = {
    mongo: mongoose.connection.readyState === 1,
    redis: redisClient.isReady,
  };
  const ok = checks.mongo && checks.redis;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
});
app.use("/api", moneyResponse);
app.use("/api/shifts", shiftsRouter);
app.use("/api/workers", workersRouter);
app.use("/api/auth", authRouter);
app.use("/api/earnings", earningsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/disputes", disputesRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/geocode", geocodeRouter);


app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  logError("server:85", err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status >= 500 ? "Server error" : err.message });
});

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = initSocket(httpServer);

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  // Last resort: never hang past the platform's kill deadline.
  const force = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 25_000);
  force.unref();

  try {
    stopCronJobs(); // no new job ticks

    // Stops accepting connections, disconnects sockets, waits for in-flight requests.
    const closed = new Promise((resolve) => io.close(() => resolve()));
    httpServer.closeIdleConnections?.(); // keep-alive connections would stall the close
    await closed;

    await waitForCronJobs(15_000); // let running jobs finish before pulling the database away

    await mongoose.disconnect();
    if (redisClient.isOpen) await redisClient.quit();

    console.log("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logError("Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  logError("Uncaught exception:", err);
  process.exit(1); // state may be corrupt; let the platform restart us
});

connectDB()
  .then(() => connectRedis())
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
    startCronJobs();
  })
  .catch((err) => {
    logError("Startup failed:", err);
    process.exit(1);
  });