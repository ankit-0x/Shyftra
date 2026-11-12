// server/src/routes/uploads.js
import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";
import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { looksLikeAllowedImage } from "../utils/evidenceSniff.js";
import { broadcastToRole } from "../utils/notify.js"; // ✅ Add this
import { logError } from "../utils/logger.js";


const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, or WEBP images are allowed"));
    }
    cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

// Best-effort delete: a failed cleanup must never fail the request.
function destroyQuietly(publicId, options) {
  cloudinary.uploader
    .destroy(publicId, options)
    .catch((err) =>
        logError(`Cloudinary cleanup failed for ${publicId}:`, err)
    );
}

// POST /api/uploads/avatar
router.post(
  "/avatar",
  requireAuth,
  uploadLimiter,
  handleUpload,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!looksLikeAllowedImage(req.file.buffer)) {
      return res
        .status(400)
        .json({ error: "File is not a valid JPEG, PNG, or WEBP image" });
    }

    try {
      // 1. Upload the NEW file first.
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "shyftra/avatars",
        resource_type: "image",
      });

      // 2. Point the user at it; get the OLD record back.
      const previous = await User.findByIdAndUpdate(
        req.user._id,
        { avatarUrl: result.secure_url, avatarPublicId: result.public_id },
        { returnDocument: "before" },
      );
      if (!previous) {
        destroyQuietly(result.public_id);
        return res.status(404).json({ error: "User not found" });
      }

      // 3. Only now delete the old file.
      if (previous.avatarPublicId) destroyQuietly(previous.avatarPublicId);

      res.json({ avatarUrl: result.secure_url });
    } catch (err) {
      logError("uploads:79", err);
      res.status(500).json({ error: "Failed to update avatar" });
    }
  },
);

// POST /api/uploads/verification-doc
router.post(
  "/verification-doc",
  requireAuth,
  uploadLimiter,
  handleUpload,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!looksLikeAllowedImage(req.file.buffer)) {
      return res
        .status(400)
        .json({ error: "File is not a valid JPEG, PNG, or WEBP image" });
    }
    if (req.user.verificationStatus === "verified") {
      return res
        .status(409)
        .json({ error: "Your account is already verified" });
    }

    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "shyftra/verification-docs",
        resource_type: "image",
        type: "authenticated",
      });

      // The filter makes this atomic: it can't overwrite an admin approval
      // that landed between the check above and now.
      const previous = await User.findOneAndUpdate(
        { _id: req.user._id, verificationStatus: { $ne: "verified" } },
        {
          verificationDocPublicId: result.public_id,
          verificationStatus: "pending",
        },
        { returnDocument: "before" },
      );
      if (!previous) {
        destroyQuietly(result.public_id, { type: "authenticated" });
        return res
          .status(409)
          .json({ error: "Your account is already verified" });
      }

      if (previous.verificationDocPublicId) {
        destroyQuietly(previous.verificationDocPublicId, {
          type: "authenticated",
        });
      }
      // ✅ NEW: Notify admins
      broadcastToRole("admin", "admin:queue_changed", { kind: "verification" });
      res.json({ verificationStatus: "pending" });
    } catch (err) {
      logError("uploads:137", err);
      res.status(500).json({ error: "Failed to upload verification document" });
    }
  },
);

export default router;
