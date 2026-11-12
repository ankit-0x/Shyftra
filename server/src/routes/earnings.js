// server/src/routes/earnings.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { isWorker } from "../middleware/roles.js";
import {
  getEarningsSummary,
  getEarningsStats,
  getShiftHistory,
  getCompensationHistory,   // ✅ NEW
} from "../controllers/earningsController.js";

const router = express.Router();

router.get("/summary", requireAuth, isWorker, getEarningsSummary);
router.get("/stats", requireAuth, isWorker, getEarningsStats);
router.get("/history", requireAuth, isWorker, getShiftHistory);
router.get("/compensations", requireAuth, isWorker, getCompensationHistory);   // ✅ NEW

export default router;