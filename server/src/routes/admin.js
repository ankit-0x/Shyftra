// server/src/routes/admin.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { isAdmin } from "../middleware/roles.js";
import {
  getPendingVerifications,
  getAllUsers,
  getVerificationDocUrl,
  verifyUser,
  toggleBlockUser,
  unbanUser,
  resetStrikes,
  forceLogoutUser,
  getAllShifts,
  getAnalytics,
  getPlatformWallet,
  getDisputes,
  resolveDispute,
  cancelShift,
  deleteShift,
  getFullUserProfile,
  handleBannedWalletAction,
} from "../controllers/adminController.js";
import {adminReauthLimiter} from "../middleware/rateLimiters.js";
import { getLedgerChecks, runLedgerNow } from "../controllers/adminController.js";

const router = express.Router();

const OBJECT_ID = /^[a-f\d]{24}$/i;
router.param("id", (req, res, next, value) =>
  OBJECT_ID.test(value) ? next() : res.status(404).json({ error: "Not found" }),
);

router.get("/pending", requireAuth, isAdmin, getPendingVerifications);
router.get("/users", requireAuth, isAdmin, getAllUsers);
router.get(
  "/:id/verification-doc-url",
  requireAuth,
  isAdmin,
  getVerificationDocUrl,
);
router.patch("/:id/verify", requireAuth, isAdmin, verifyUser);
router.patch("/users/:id/block", requireAuth, isAdmin, toggleBlockUser);
// ✅ NEW: Explicit unban (clears strikes + isBanned)
router.post("/users/:id/unban", requireAuth, isAdmin, unbanUser);
// ✅ NEW: Reset strikes only
router.post("/users/:id/reset-strikes", requireAuth, isAdmin, resetStrikes);
// Force logout: re-auth (admin's own password) + failed-attempt limiter + audit log inside.
router.post("/users/:id/force-logout", requireAuth, isAdmin, adminReauthLimiter, forceLogoutUser);
router.get("/shifts", requireAuth, isAdmin, getAllShifts);
router.get("/analytics", requireAuth, isAdmin, getAnalytics);
router.get("/platform-wallet", requireAuth, isAdmin, getPlatformWallet);
router.get("/disputes", requireAuth, isAdmin, getDisputes);
router.put("/disputes/:id/resolve", requireAuth, isAdmin, resolveDispute);
router.patch("/shifts/:id/cancel", requireAuth, isAdmin, cancelShift);
router.delete("/shifts/:id", requireAuth, isAdmin, deleteShift);
router.get("/users/:id/profile", requireAuth, isAdmin, getFullUserProfile);
router.get("/ledger", requireAuth, isAdmin, getLedgerChecks);
router.post("/ledger/run", requireAuth, isAdmin, runLedgerNow);
router.post("/users/:id/wallet-action", requireAuth, isAdmin, adminReauthLimiter, handleBannedWalletAction);

export default router;
