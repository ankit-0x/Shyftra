// server/src/routes/disputes.js

import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { z } from "zod";

import Dispute from "../models/Dispute.js";

import { requireAuth } from "../middleware/auth.js";
import { isWorker, isEmployer } from "../middleware/roles.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";

import {
  raiseDispute,
  submitEvidence,
} from "../services/disputeService.js";

import {
  uploadBufferToCloudinary,
} from "../utils/uploadToCloudinary.js";

import {
  looksLikeAllowedEvidence,
} from "../utils/evidenceSniff.js";

import { HttpError } from "../utils/HttpError.js";
import { safeEmit, broadcastToRole } from "../utils/notify.js";
import cloudinary from "../config/cloudinary.js";

import { logError } from "../utils/logger.js";
const router = express.Router();

const OBJECT_ID = /^[a-f\d]{24}$/i;
router.param("id", (req, res, next, value) =>
  OBJECT_ID.test(value) ? next() : res.status(404).json({ error: "Not found" }),
);

/*
 * Evidence types supported by the application.
 *
 * Images:
 * - JPEG
 * - PNG
 * - WebP
 *
 * Videos:
 * - MP4
 * - WebM
 * - MOV
 */
const ALLOWED_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",

  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/*
 * Multer configuration.
 *
 * Files are kept in memory because they are sent directly
 * to Cloudinary after validation.
 */
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    // 50 MB maximum for EACH file.
    fileSize: 50 * 1024 * 1024,

    // Maximum 5 evidence files per submission.
    files: 5,
  },

  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EVIDENCE_TYPES.has(file.mimetype)) {
      return cb(
        new Error(
          "Only JPEG, PNG, WebP, MP4, WebM, or MOV files are allowed",
        ),
      );
    }

    cb(null, true);
  },
});

const disputeReasonSchema = z.object({
  reason: z.string().min(10, "Please describe the issue in a bit more detail").max(1000),
  claimedTime: z.string().datetime(), // 👈 NAYA FIELD
});


/* =========================================================
   POST /api/disputes/shift-record/:id
   Worker disputes a force-clock-out
   ========================================================= */

router.post(
  "/shift-record/:id",
  requireAuth,
  isWorker,
  async (req, res) => {
    const parsed = disputeReasonSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0].message,
      });
    }

    const session = await mongoose.startSession();

    let dispute;

    try {
      await session.withTransaction(async () => {
        dispute = await raiseDispute({
          shiftRecordId: req.params.id,
          workerUserId: req.user._id,
          reason: parsed.data.reason,
          claimedTime: new Date(parsed.data.claimedTime),
          session,
        });
      });
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({
          error: err.message,
        });
      }

      logError("Raise dispute error:", err);

      return res.status(500).json({
        error: "Failed to raise dispute",
      });
    } finally {
      await session.endSession();
    }

    safeEmit(
      dispute.employer,
      "dispute:raised",
      {
        disputeId: dispute._id,
        shiftId: dispute.shift,
        proofDeadline: dispute.proofDeadline,
      },
    );

    // ✅ NEW: Notify admins
    broadcastToRole("admin", "admin:queue_changed", { kind: "dispute" });
    return res.status(201).json({
      dispute,
    });
  },
);


/* =========================================================
   POST /api/disputes/:id/evidence

   Employer uploads evidence.

   Supported:
   - JPEG
   - PNG
   - WebP
   - MP4
   - WebM
   - MOV

   Maximum:
   - 5 files
   - 50 MB per file

   Photo + video can be mixed in the same submission.
   ========================================================= */

router.post(
  "/:id/evidence",

  // 1. User must be authenticated.
  requireAuth,

  // 2. Only employer can submit evidence.
  isEmployer,

  // 3. Rate-limit before processing files.
  uploadLimiter,

  // 4. Verify dispute/deadline BEFORE multer reads files.
  assertCanSubmitEvidence,

  // 5. Parse multipart/form-data.
  handleEvidenceUpload,

  async (req, res) => {
    /*
     * Multer succeeded, but no files were provided.
     */
    if (!req.files?.length) {
      return res.status(400).json({
        error: "At least one evidence file is required",
      });
    }

    /*
     * IMPORTANT:
     *
     * file.mimetype comes from the upload request and should
     * not be trusted as the only validation mechanism.
     *
     * We also inspect the actual file bytes.
     */
    for (const file of req.files) {
      const valid = looksLikeAllowedEvidence(
        file.buffer,
        file.mimetype,
      );

      if (!valid) {
        return res.status(400).json({
          error: `Invalid evidence file: ${file.originalname}`,
        });
      }
    }

    /*
     * Cloudinary uploads that have succeeded.
     *
     * If something fails later, these are deleted.
     */
    let uploaded = [];

    /*
     * Used to determine whether Cloudinary files should
     * be deleted if an error happens later.
     */
    let committed = false;

    try {
      /*
       * Upload all files in parallel.
       *
       * Images:
       *   resource_type = image
       *
       * Videos:
       *   resource_type = video
       */
      const results = await Promise.allSettled(
        req.files.map((file) => {
          const resourceType =
            file.mimetype.startsWith("video/")
              ? "video"
              : "image";

          return uploadBufferToCloudinary(
            file.buffer,
            {
              folder: "shyftra/disputes",
              resource_type: resourceType,
              type: "authenticated",
            },
          );
        }),
      );

      /*
       * Keep only successful Cloudinary uploads.
       */
      uploaded = results
        .filter(
          (result) => result.status === "fulfilled",
        )
        .map(
          (result) => result.value,
        );

      /*
       * If even ONE upload failed:
       *
       * - delete all successful uploads
       * - don't save anything to MongoDB
       */
      if (uploaded.length !== req.files.length) {
        await destroyAll(uploaded);

        return res.status(502).json({
          error: "Upload failed, please try again",
        });
      }

            /*
       * Extract public IDs + resource types for the dispute service.
       *
       * For authenticated (private) files, secure_url needs a signature, so we
       * can't hand it to the UI directly. Signed URLs are generated on demand
       * by GET /api/disputes/:id/evidence/url.
       */
      const evidencePublicIds = uploaded.map((r) => r.public_id);
      const evidenceResourceTypes = uploaded.map(
        (r) => r.resource_type || "image",
      );

      const session = await mongoose.startSession();

      let dispute;

      try {
        await session.withTransaction(async () => {
          dispute = await submitEvidence({
            disputeId: req.params.id,
            employerUserId: req.user._id,
            evidencePublicIds,
            evidenceResourceTypes,
            session,
          });
        });

        /*
         * MongoDB transaction succeeded.
         *
         * Cloudinary files should now remain.
         */
        committed = true;
      } finally {
        await session.endSession();
      }

      /*
       * Notify worker only after DB transaction succeeded.
       */
      safeEmit(
        dispute.worker,
        "dispute:evidence_submitted",
        {
          disputeId: dispute._id,
        },
      );

      broadcastToRole("admin", "admin:queue_changed", { kind: "dispute" });

      return res.json({
        dispute,
      });
    } catch (err) {
      /*
       * If DB transaction failed, remove the Cloudinary
       * files so we don't leave orphaned evidence.
       */
      if (!committed) {
        await destroyAll(uploaded);
      }

      if (err instanceof HttpError) {
        return res.status(err.status).json({
          error: err.message,
        });
      }

      logError("Evidence submission error:", err);

      return res.status(500).json({
        error: "Failed to submit evidence",
      });
    }
  },
);


/* =========================================================
   GET /api/disputes/mine

   Either role can see their own disputes.
   ========================================================= */

router.get(
  "/mine",
  requireAuth,
  async (req, res) => {
    try {
      const filter =
        req.user.role === "worker"
          ? { worker: req.user._id }
          : { employer: req.user._id };

      const disputes = await Dispute.find(filter)
        .sort({ createdAt: -1 })
        .limit(50);

      return res.json(disputes);
    } catch (err) {
      logError("Fetch own disputes error:", err);

      return res.status(500).json({
        error: "Failed to fetch disputes",
      });
    }
  },
);


/* =========================================================
   GET /api/disputes/:id

   Either party on the dispute or an admin.
   ========================================================= */

router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const dispute = await Dispute.findById(
        req.params.id,
      );

      if (!dispute) {
        return res.status(404).json({
          error: "Dispute not found",
        });
      }

      const isParty = [
        dispute.worker.toString(),
        dispute.employer.toString(),
      ].includes(
        req.user._id.toString(),
      );

      if (
        !isParty &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "You're not part of this dispute",
        });
      }

      return res.json({
        dispute,
      });
    } catch (err) {
      logError("Fetch dispute error:", err);

      return res.status(500).json({
        error: "Failed to fetch dispute",
      });
    }
  },
);

/* =========================================================
   GET /api/disputes/:id/evidence/url?publicId=...

   Returns a short-lived signed URL for ONE private evidence file.
   Accessible only to: admin, worker of the dispute, employer of the dispute.
   ========================================================= */

router.get(
  "/:id/evidence/url",
  requireAuth,
  async (req, res) => {
    try {
      // Validate dispute id + publicId shape before any DB work.
      if (!OBJECT_ID.test(req.params.id)) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const publicId = String(req.query.publicId || "");
      if (
        !publicId ||
        publicId.length > 200 ||
        /[\u0000-\u001f\u007f]/.test(publicId)
      ) {
        return res.status(400).json({ error: "Invalid file identifier" });
      }

      const dispute = await Dispute.findById(req.params.id)
        .select("worker employer evidencePublicIds evidenceResourceTypes")
        .lean();

      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const isParty = [
        dispute.worker.toString(),
        dispute.employer.toString(),
      ].includes(req.user._id.toString());
      if (!isParty && req.user.role !== "admin") {
        return res.status(403).json({ error: "You're not part of this dispute" });
      }

      // Confirm this publicId actually belongs to this dispute — otherwise
      // someone could use this endpoint as a generic Cloudinary signer.
      const idx = dispute.evidencePublicIds.findIndex((p) => p === publicId);
      if (idx === -1) {
        return res.status(404).json({ error: "Evidence file not found" });
      }

      const resourceType = dispute.evidenceResourceTypes[idx] || "image";

      // Short-lived signed URL. No `expires_at` — that's a paid-tier Cloudinary
      // feature. On free tier we regenerate the URL on every request instead;
      // the URL is only useful while the page that requested it is open.
      const signedUrl = cloudinary.url(publicId, {
        type: "authenticated",
        resource_type: resourceType,
        sign_url: true,
      });

      return res.json({ url: signedUrl, resourceType });
    } catch (err) {
      logError("Signed evidence URL error:", err);
      return res.status(500).json({ error: "Failed to load file" });
    }
  },
);

/* =========================================================
   Evidence authorization middleware

   IMPORTANT:
   This runs BEFORE multer.

   Therefore:
   - invalid dispute doesn't load files
   - wrong employer doesn't load files
   - expired proof window doesn't load files
   ========================================================= */

async function assertCanSubmitEvidence(
  req,
  res,
  next,
) {
  try {
    /*
     * Avoid unnecessary MongoDB query for malformed IDs.
     */
    if (!OBJECT_ID.test(req.params.id)) {
      return res.status(404).json({
        error: "Dispute not found",
      });
    }

    const dispute = await Dispute.findById(
      req.params.id,
    )
      .select(
        "employer status proofDeadline",
      )
      .lean();

    if (!dispute) {
      return res.status(404).json({
        error: "Dispute not found",
      });
    }

    /*
     * Only the employer associated with this dispute
     * can submit evidence.
     */
    if (
      dispute.employer.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        error: "This isn't your dispute",
      });
    }

    /*
     * Evidence is accepted only while the dispute
     * is waiting for proof.
     */
    if (
      dispute.status !== "awaiting_proof"
    ) {
      return res.status(409).json({
        error:
          "This dispute is no longer accepting evidence",
      });
    }

    /*
     * Ensure the proof deadline exists and hasn't passed.
     */
    if (
      !dispute.proofDeadline ||
      dispute.proofDeadline < new Date()
    ) {
      return res.status(409).json({
        error:
          "The 48-hour proof window has passed",
      });
    }

    next();
  } catch (err) {
    logError("Evidence authorization error:", err);

    return res.status(500).json({
      error: "Failed to check dispute",
    });
  }
}


/* =========================================================
   Multer wrapper

   Handles Multer errors cleanly instead of sending them
   to the global Express error handler.
   ========================================================= */

function handleEvidenceUpload(
  req,
  res,
  next,
) {
  upload.array("files", 5)(
    req,
    res,
    (err) => {
      if (!err) {
        return next();
      }

      /*
       * Multer-specific errors.
       */
      if (err instanceof multer.MulterError) {
        if (
          err.code === "LIMIT_FILE_SIZE"
        ) {
          return res.status(400).json({
            error:
              "Each evidence file must be 50 MB or smaller",
          });
        }

        if (
          err.code === "LIMIT_FILE_COUNT"
        ) {
          return res.status(400).json({
            error:
              "Maximum 5 evidence files are allowed",
          });
        }

        if (
          err.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          return res.status(400).json({
            error:
              "Maximum 5 evidence files are allowed",
          });
        }

        return res.status(400).json({
          error: err.message,
        });
      }

      /*
       * fileFilter errors.
       */
      return res.status(400).json({
        error:
          err.message ||
          "Invalid evidence upload",
      });
    },
  );
}


/* =========================================================
   Delete Cloudinary uploads

   Handles both image and video resources.
   ========================================================= */

async function destroyAll(uploaded) {
  if (!uploaded?.length) {
    return;
  }

  await Promise.allSettled(
    uploaded.map((uploadResult) => {
      if (!uploadResult?.public_id) {
        return Promise.resolve();
      }

      return cloudinary.uploader.destroy(
        uploadResult.public_id,
        {
          resource_type:
            uploadResult.resource_type ||
            "image",
          type: "authenticated",
        },
      );
    }),
  );
}


export default router;