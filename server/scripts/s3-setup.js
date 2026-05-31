/**
 * s3:setup — one-shot provisioner for the media bucket. Creates the bucket (if
 * missing) and applies the CORS policy, using the AWS credentials in your env.
 * Public access stays blocked (presigned URLs work on private buckets).
 *
 * Prerequisites: AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY set, and the IAM user needs s3:CreateBucket +
 * s3:PutBucketCors permissions.
 *
 * Usage: npm run s3:setup
 */
import {
  isS3Configured,
  ensureBucket,
  applyBucketCors,
  getBucketCors,
} from "../src/services/s3.js";

async function main() {
  if (!isS3Configured()) {
    throw new Error("S3 not configured — set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.");
  }

  const { bucket, created, region } = await ensureBucket();
  console.log(created ? `✅ Created bucket "${bucket}"${region ? ` in ${region}` : ""}.` : `ℹ️  Bucket "${bucket}" already exists.`);

  const { origins } = await applyBucketCors();
  console.log(`✅ Applied CORS for origins:`);
  for (const o of origins) console.log(`   • ${o}`);

  const rules = await getBucketCors();
  console.log("\nCurrent CORS rules:");
  console.log(JSON.stringify(rules, null, 2));
  console.log("\nDone. Restart the server — startup should now log: S3: connected.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("s3:setup failed:", err.name ? `${err.name} — ${err.message}` : err.message);
    process.exit(1);
  });
