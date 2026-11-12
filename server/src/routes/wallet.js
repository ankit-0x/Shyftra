// server/src/routes/wallet.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { isEmployer, requireVerified } from "../middleware/roles.js";
import {
  createTopupOrder, verifyTopup, failTopup, addPayoutMethod, requestPayout, handleRazorpayWebhook,
  getWalletSummary, getPayoutMethod, sendCashoutOtp,
} from "../controllers/walletController.js";
import { payoutOtpSendLimiter, payoutVerifyLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/topup/create-order", requireAuth, isEmployer, requireVerified, createTopupOrder);
router.post("/topup/verify", requireAuth, isEmployer, requireVerified, verifyTopup);
router.post("/topup/fail", requireAuth, isEmployer, failTopup);

// Saving a payout method: needs the current password (checked in the controller).
router.get("/payout-method", requireAuth, getPayoutMethod);
router.post("/payout-method", requireAuth, requireVerified, payoutVerifyLimiter, addPayoutMethod);

// Cash-out: step 1 = email me a code, step 2 = submit amount + code.
router.post("/payout-otp", requireAuth, requireVerified, payoutOtpSendLimiter, sendCashoutOtp);
router.post("/payout", requireAuth, requireVerified, payoutVerifyLimiter, requestPayout); // works for either role

router.post("/webhook", handleRazorpayWebhook);
router.get("/summary", requireAuth, getWalletSummary);

export default router;
