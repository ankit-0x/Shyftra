import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import Worker from "../models/Worker.js";
import Employer from "../models/Employer.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

const workerProfileSchema = z.object({
  skills: z.array(z.string()).optional(),
  hourlyRate: z.number().positive().optional(),
  bio: z.string().max(1000).optional(),
});

const employerProfileSchema = z.object({
  businessName: z.string().min(2).optional(),
  description: z.string().max(1000).optional(),
  address: z.string().optional(),
});

// GET /api/profile — works for either role, returns the right shape for each.
router.get("/", requireAuth, async (req, res) => {
  try {
    let roleProfile = null;
    if (req.user.role === "worker") {
      roleProfile = await Worker.findOne({ user: req.user._id });
    } else if (req.user.role === "employer") {
      roleProfile = await Employer.findOne({ user: req.user._id });
    }

    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      avatarUrl: req.user.avatarUrl,
      verificationStatus: req.user.verificationStatus,
      profile: roleProfile,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// PUT /api/profile — same upsert pattern as Day 13's Employer auto-creation.
router.put("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role === "worker") {
      const parsed = workerProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const profile = await Worker.findOneAndUpdate(
        { user: req.user._id },
        { $set: parsed.data, $setOnInsert: { user: req.user._id } },
        { upsert: true, returnDocument: "after" },
      );
      return res.json({ profile });
    }

    if (req.user.role === "employer") {
      const parsed = employerProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const update = {
        ...parsed.data,
      };

      if (!update.businessName) {
        update.businessName = req.user.name;
      }

      const profile = await Employer.findOneAndUpdate(
        { user: req.user._id },
        {
          $set: update,
          $setOnInsert: {
            user: req.user._id,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );
      return res.json({ profile });
    }

    res.status(400).json({ error: "Unsupported role" });
  } catch (err) {
    logError("profile:94", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
