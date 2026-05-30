import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  isS3Configured,
  createUploadUrl,
  createDownloadUrl,
  deleteObject,
  keyBelongsToUser,
  ALLOWED_TYPES,
} from "../services/s3.js";

const router = Router();

// Reject early with a clear message if the server has no S3 config.
router.use((req, res, next) => {
  if (!isS3Configured()) {
    return res.status(503).json({
      error: "Media storage is not configured. Set AWS_S3_BUCKET and AWS credentials.",
    });
  }
  next();
});

// All media operations require an authenticated user.
router.use(authenticate);

/**
 * POST /api/media/upload-url
 * Body: { contentType, prefix? }
 * Returns a presigned PUT URL. The client uploads the file directly to S3:
 *   await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } })
 * then sends back the returned `key` to associate the media with a record.
 */
router.post("/upload-url", async (req, res, next) => {
  try {
    const { contentType, prefix } = req.body;
    const result = await createUploadUrl({ contentType, prefix, ownerId: req.user.id });
    res.json(result);
  } catch (err) {
    if (err.message.includes("content type")) return res.status(400).json({ error: err.message });
    next(err);
  }
});

/**
 * GET /api/media/download-url?key=users/<id>/...
 * Returns a short-lived presigned GET URL. A user may only fetch objects under
 * their own namespace — prevents reading another user's media by guessing keys.
 */
router.get("/download-url", async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: "key query parameter is required" });
    if (!keyBelongsToUser(key, req.user.id)) {
      return res.status(403).json({ error: "You do not have access to this object." });
    }
    const result = await createDownloadUrl(key);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/media?key=users/<id>/... — remove one of the caller's own objects. */
router.delete("/", async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: "key query parameter is required" });
    if (!keyBelongsToUser(key, req.user.id)) {
      return res.status(403).json({ error: "You do not have access to this object." });
    }
    const result = await deleteObject(key);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/media/allowed-types — content types the upload endpoint accepts. */
router.get("/allowed-types", (req, res) => {
  res.json({ allowedTypes: Object.keys(ALLOWED_TYPES) });
});

export default router;
