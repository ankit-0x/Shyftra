// server/src/config/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import redisClient from "./redis.js";
import User from "../models/User.js";
import Worker from "../models/Worker.js";
import { z } from "zod";
import { ALLOWED_ORIGIN } from "./origin.js";

import { logError } from "../utils/logger.js";
let io;

// --- connection limits (B-14) ---
const MAX_SOCKETS_PER_USER = 10;
const MAX_GUEST_SOCKETS_PER_IP = 50;
const guestCounts = new Map();
// Behind Render's proxy the real client IP is the LAST x-forwarded-for entry.
function clientIp(socket) {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (xff) {
    const parts = String(xff).split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return socket.handshake.address;
}

// --- coalesced "workers:changed" (B-13) ---
const WORKERS_CHANGED_WINDOW_MS = 3000;
let workersChangedTimer = null;
function notifyWorkersChanged() {
  if (workersChangedTimer) return;
  workersChangedTimer = setTimeout(() => {
    workersChangedTimer = null;
    io?.to("role:employer").emit("workers:changed");
  }, WORKERS_CHANGED_WINDOW_MS);
  workersChangedTimer.unref?.();
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGIN,
      credentials: true, 
    },
    maxHttpBufferSize: 10_000,
  });

  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== ALLOWED_ORIGIN) {
        console.warn(`[socket] origin rejected: "${origin}" (allowed: "${ALLOWED_ORIGIN}")`);
        return next(new Error("Unauthorized"));
      }

      const rawCookies = socket.handshake.headers.cookie;
      const cookies = rawCookies ? cookie.parseCookie(rawCookies) : {};
      const token = cookies.accessToken;

            // 🆕 Guest Logic: Agar token nahi hai, toh guest allow karein
      if (!token) {
        if ((guestCounts.get(clientIp(socket)) ?? 0) >= MAX_GUEST_SOCKETS_PER_IP) {
          return next(new Error("Too many connections"));
        }
        socket.isGuest = true;
        return next();
      }

      // 🆕 Fail closed if Redis is down
      let isBlacklisted;
      try {
        isBlacklisted = await redisClient.get(`blacklist:${token}`);
      } catch (err) {
        logError("socket: redis blacklist check failed", err);
        return next(new Error("Unauthorized"));
      }
      if (isBlacklisted) return next(new Error("Unauthorized"));

      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
      });

      const user = await User.findById(payload.userId);
      if (!user || !user.isActive || user.isBanned)
        return next(new Error("Unauthorized"));

      const tokenVersion = payload.tv ?? 0;
      const userVersion = user.tokenVersion ?? 0;
      if (tokenVersion !== userVersion) return next(new Error("Unauthorized"));

      const open = io.sockets.adapter.rooms.get(`user:${user._id}`)?.size ?? 0;
      if (open >= MAX_SOCKETS_PER_USER) return next(new Error("Too many connections"));

      socket.user = user;
      socket.isGuest = false;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
        // 🆕 Guest ko sirf public feed join karayein aur yahin ruk jayein
    if (socket.isGuest) {
      socket.join("public:feed");
      const ip = clientIp(socket);
      guestCounts.set(ip, (guestCounts.get(ip) ?? 0) + 1);
      socket.on("disconnect", () => {
        const left = (guestCounts.get(ip) ?? 1) - 1;
        if (left <= 0) guestCounts.delete(ip);
        else guestCounts.set(ip, left);
      });
      return; 
    }

    // Logged-in users ka purana logic
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`); 
    console.log(`Socket connected: user ${socket.user._id}`);

    const locationSchema = z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    });

    socket.on("update_location", async (data) => {
      try {
        if (socket.user.role !== "worker") return;
        const now = Date.now();
        if (socket.lastLocationAt && now - socket.lastLocationAt < 5000) return; 
        const parsed = locationSchema.safeParse(data);
        if (!parsed.success) return;
        socket.lastLocationAt = now;

        const { lat, lng } = parsed.data;
        await Worker.findOneAndUpdate(
          { user: socket.user._id },
          {
            $set: {
              isAvailable: true,
              location: { type: "Point", coordinates: [lng, lat] },
              lastLocationUpdate: new Date(),
            },
          },
        );

                notifyWorkersChanged();
      } catch (err) {
        logError("Socket location update failed:", err);
      }
    });

    socket.on("disconnect", async () => {
      if (socket.user.role !== "worker") return;
      try {
        const remaining = await io.in(`user:${socket.user._id}`).fetchSockets();
        if (remaining.length > 0) return;

        await Worker.findOneAndUpdate(
          { user: socket.user._id },
          { $set: { isAvailable: false } },
        );

                notifyWorkersChanged();
        console.log(`Worker ${socket.user._id} disconnected. Marked offline.`);
      } catch (err) {
        logError("Socket disconnect update failed:", err);
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}