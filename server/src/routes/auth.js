// server/src/routes/auth.js
import express from "express";
import {
  registerUser, loginUser, logoutUser, logoutAllDevices, refreshToken, getMe,
  verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword,
} from "../controllers/authController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import {
  registerLimiter, loginIpLimiter, loginAccountLimiter, refreshLimiter,
  emailFlowIpLimiter, resendVerificationLimiter, forgotPasswordLimiter,
  tokenSubmitLimiter, changePasswordLimiter,
  emailChangeIpLimiter, emailChangeSendLimiter, emailChangeFailLimiter,
} from "../middleware/rateLimiters.js";
import {
  requestEmailChangeHandler, resendEmailChangeHandler, verifyEmailChangeHandler,
} from "../controllers/emailChangeController.js";

const router = express.Router();

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginIpLimiter, loginAccountLimiter, loginUser);
// No requireAuth: logging out with an EXPIRED access token must still clear cookies.
router.post("/logout", logoutUser);
router.post("/logout-all", requireAuth, logoutAllDevices);
router.post("/refresh", refreshLimiter, refreshToken);

// Task 2: email verification
router.post("/verify-email/:token", tokenSubmitLimiter, verifyEmail);
router.post("/resend-verification", emailFlowIpLimiter, resendVerificationLimiter, resendVerification);

// Task 3: forgot / reset password
router.post("/forgot-password", emailFlowIpLimiter, forgotPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", tokenSubmitLimiter, resetPassword);

// Task 4: change password (logged in)
router.patch("/change-password", requireAuth, changePasswordLimiter, changePassword);

// Change email (logged in): password re-auth -> code to the NEW address -> verify.
router.post("/change-email/request", requireAuth, emailChangeIpLimiter, emailChangeFailLimiter, emailChangeSendLimiter, requestEmailChangeHandler);
router.post("/change-email/resend", requireAuth, emailChangeIpLimiter, emailChangeSendLimiter, resendEmailChangeHandler);
router.post("/change-email/verify", requireAuth, emailChangeFailLimiter, verifyEmailChangeHandler);
// /me is a "who am I?" endpoint — it should NEVER 401 for a guest.
router.get("/me", optionalAuth, getMe);

export default router;
