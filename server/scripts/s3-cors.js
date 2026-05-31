/**
 * s3:cors — apply the bucket CORS policy so browsers can upload/download via
 * presigned URLs from the allowed origins (localhost dev + aidvocate.app).
 *
 * Origins default to localhost:5173/5174 + https://aidvocate.app + www, and can
 * be overridden with S3_CORS_ORIGINS="https://a.com,https://b.com".
 *
 * Usage:
 *   npm run s3:cors          # apply the policy, then print what's set
 *   npm run s3:cors -- --show  # only print the current policy, don't change it
 */
import {
  isS3Configured,
  applyBucketCors,
  getBucketCors,
  DEFAULT_CORS_ORIGINS,
} from "../src/services/s3.js";

async function main() {
  if (!isS3Configured()) {
    throw new Error("S3 not configured — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.");
  }

  const showOnly = process.argv.includes("--show");

  if (!showOnly) {
    const { bucket, origins } = await applyBucketCors();
    console.log(`Applied CORS to "${bucket}" for origins:`);
    for (const o of origins) console.log(`  • ${o}`);
  }

  const rules = await getBucketCors();
  console.log("\nCurrent bucket CORS rules:");
  console.log(JSON.stringify(rules, null, 2));
  if (showOnly && DEFAULT_CORS_ORIGINS.length) {
    console.log(`\n(run without --show to apply: ${DEFAULT_CORS_ORIGINS.join(", ")})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("s3:cors failed:", err.message);
    process.exit(1);
  });
