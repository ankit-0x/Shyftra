// server/src/routes/workers.js
import express from "express";
import { z } from "zod";
import Worker from "../models/Worker.js";
import { browseLimiter } from "../middleware/rateLimiters.js";
import { requireAuth } from "../middleware/auth.js";
import { isEmployer, requireVerified } from "../middleware/roles.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

const STALE_LOCATION_MS = 10 * 60 * 1000; // ignore workers not seen for 10 min
const DISTANCE_BUCKET_M = 500;            // never reveal exact distance

const browseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50).default(10),
  _r: z.coerce.number().optional(), // cache-buster
});

// GET /api/workers/browse?lat=..&lng=..&radius=..
// Verified employers only. Distances are rounded up to 500 m steps.
router.get("/browse", requireAuth, isEmployer, requireVerified, browseLimiter, async (req, res) => {
  const parsed = browseQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { lat, lng, radius: radiusKm } = parsed.data;

  try {
    const workers = await Worker.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: {
            isAvailable: true,
            lastLocationUpdate: { $gt: new Date(Date.now() - STALE_LOCATION_MS) },
          },
        },
      },
      { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      {
        $match: {
          "user.isActive": { $ne: false },
          "user.isBanned": { $ne: true },
          "user.verificationStatus": "verified",
        },
      },
      { $limit: 50 },
      {
        $project: {
          name: "$user.name",
          skills: 1,
          rating: 1,
          distanceMeters: {
            $multiply: [{ $ceil: { $divide: ["$distanceMeters", DISTANCE_BUCKET_M] } }, DISTANCE_BUCKET_M],
          },
        },
      },
    ]);

    res.json(workers);
  } catch (err) {
    logError("workers:68", err);
    res.status(500).json({ error: "Failed to fetch workers" });
  }
});

export default router;