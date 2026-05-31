import "dotenv/config";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET || "";
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";

// Presigned URLs are valid for 5 minutes by default — long enough for a
// browser upload/download, short enough to limit replay if the URL leaks.
const DEFAULT_EXPIRES = 300;

// Content types we accept for media uploads, mapped to a file extension.
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

let client;

/** True when AWS credentials + bucket are configured. */
export function isS3Configured() {
  return Boolean(BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

/**
 * Actually verify the bucket is reachable with the configured credentials
 * (a HeadBucket call). Returns a result object rather than throwing so callers
 * (e.g. startup logging) can decide how to react. S3 is optional, so a failure
 * here should NOT crash the server.
 */
export async function checkS3Connection() {
  if (!isS3Configured()) {
    return { configured: false, ok: false, bucket: BUCKET || null };
  }
  try {
    await getClient().send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { configured: true, ok: true, bucket: BUCKET, region: REGION };
  } catch (err) {
    // HeadBucket returns bodiless errors, so lead with the HTTP status which is
    // the most diagnostic: 403 = bad creds / no access, 404 = bucket missing,
    // 301 = bucket is in a different region than AWS_REGION.
    const status = err?.$metadata?.httpStatusCode;
    const detail = [err.name, status && `HTTP ${status}`, err.message]
      .filter(Boolean)
      .join(" — ");
    return { configured: true, ok: false, bucket: BUCKET, region: REGION, error: detail };
  }
}

function getClient() {
  if (client) return client;
  if (!isS3Configured()) {
    throw new Error("S3 is not configured — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.");
  }
  client = new S3Client({
    region: REGION,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    // Keep presigned PUT URLs simple: don't bake checksum query params into the
    // signature, otherwise a plain browser `fetch(url, { method: "PUT", body })`
    // fails with a signature mismatch unless it also sends matching checksum headers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/**
 * Build a collision-free object key namespaced by the owning user:
 *   users/<ownerId>/<prefix>/<random>.<ext>
 * The owner segment is what lets download/delete enforce ownership (see
 * keyBelongsToUser) without a separate database table.
 */
function buildKey(contentType, ownerId, prefix = "media") {
  const ext = ALLOWED_TYPES[contentType] || "bin";
  const id = crypto.randomBytes(16).toString("hex");
  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "media";
  return `users/${ownerId}/${safePrefix}/${id}.${ext}`;
}

/** True if `key` lives under the given user's namespace. */
export function keyBelongsToUser(key, ownerId) {
  return typeof key === "string" && key.startsWith(`users/${ownerId}/`);
}

/**
 * Create a presigned PUT URL the client can upload a single object to directly.
 * The caller uploads with `fetch(uploadUrl, { method: 'PUT', body, headers: { 'Content-Type': contentType } })`.
 * `ownerId` namespaces the key so only that user can later fetch/delete it.
 */
export async function createUploadUrl({ contentType, prefix, ownerId, expiresIn = DEFAULT_EXPIRES }) {
  if (!contentType || !ALLOWED_TYPES[contentType]) {
    throw new Error(`Unsupported content type. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`);
  }
  if (ownerId === undefined || ownerId === null) throw new Error("ownerId is required");
  const key = buildKey(contentType, ownerId, prefix);
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return { key, uploadUrl, contentType, expiresIn };
}

/** Create a presigned GET URL to fetch a stored object. */
export async function createDownloadUrl(key, { expiresIn = DEFAULT_EXPIRES } = {}) {
  if (!key) throw new Error("Object key is required");
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const downloadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return { key, downloadUrl, expiresIn };
}

/** Permanently delete a stored object. */
export async function deleteObject(key) {
  if (!key) throw new Error("Object key is required");
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  return { key, deleted: true };
}

/**
 * Browser origins allowed to upload/download directly against the bucket via
 * presigned URLs. Overridable with S3_CORS_ORIGINS (comma-separated).
 */
export const DEFAULT_CORS_ORIGINS = (
  process.env.S3_CORS_ORIGINS ||
  "http://localhost:5173,http://localhost:5174,https://aidvocate.app,https://www.aidvocate.app"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Create the configured bucket if it doesn't already exist. New buckets keep
 * S3's default Block Public Access ON (presigned URLs work against private
 * buckets), so this never makes anything public. Returns whether it created it.
 */
export async function ensureBucket() {
  const c = getClient();

  // Already there and we can see it? Nothing to do.
  try {
    await c.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { bucket: BUCKET, created: false };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    // 404 = doesn't exist (create it). 403 = exists but owned by someone else,
    // or our credentials lack access — creating would fail too, so surface it.
    if (status && status !== 404) throw err;
  }

  // us-east-1 must NOT send a LocationConstraint; every other region must.
  const input = { Bucket: BUCKET };
  if (REGION !== "us-east-1") {
    input.CreateBucketConfiguration = { LocationConstraint: REGION };
  }

  try {
    await c.send(new CreateBucketCommand(input));
    return { bucket: BUCKET, created: true, region: REGION };
  } catch (err) {
    if (err.name === "BucketAlreadyOwnedByYou") return { bucket: BUCKET, created: false };
    throw err;
  }
}

/** Apply a CORS policy to the bucket allowing the given browser origins. */
export async function applyBucketCors(origins = DEFAULT_CORS_ORIGINS) {
  await getClient().send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            // GET for presigned downloads, PUT for presigned uploads, HEAD for metadata.
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })
  );
  return { bucket: BUCKET, origins };
}

/** Read the bucket's current CORS rules (returns [] if none set). */
export async function getBucketCors() {
  try {
    const res = await getClient().send(new GetBucketCorsCommand({ Bucket: BUCKET }));
    return res.CORSRules || [];
  } catch (err) {
    if (err.name === "NoSuchCORSConfiguration") return [];
    throw err;
  }
}

export { ALLOWED_TYPES };
