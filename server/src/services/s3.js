import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export { ALLOWED_TYPES };
