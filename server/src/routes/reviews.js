// server/src/routes/reviews.js
import express from "express";
import Review from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";

import { logError } from "../utils/logger.js";
const router = express.Router();
const OBJECT_ID = /^[a-f\d]{24}$/i;
router.param("userId", (req, res, next, value) =>
  OBJECT_ID.test(value) ? next() : res.status(404).json({ error: "Not found" }),
);

// GET /api/reviews/mine — current user's own submitted reviews
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const reviews = await Review.find({ reviewer: req.user._id })
      .populate("reviewee", "name avatarUrl")
      .populate("shift", "title")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(reviews);
  } catch (err) {
    logError("reviews:23", err);
    res.status(500).json({ error: "Failed to fetch your reviews" });
  }
});

// GET /api/reviews/user/:userId — public reviews about a specific user
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(+req.query.limit || 20, 50);
    const page = Math.max(+req.query.page || 1, 1);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ reviewee: req.params.userId })
        .populate("reviewer", "name avatarUrl")
        .populate("shift", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ reviewee: req.params.userId }),
    ]);

    res.json({ reviews, total, page, limit });
  } catch (err) {
    logError("reviews:48", err);
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

export default router;