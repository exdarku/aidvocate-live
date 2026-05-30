import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

/**
 * Centralised, validated configuration. Importing this module is the single
 * place env vars are read — it fails fast on boot if something required for
 * production is missing or unsafe, rather than silently falling back to a
 * dev default that would make the deployment insecure.
 */
function required(name, { min } = {}) {
  const value = process.env[name];
  if (!value) {
    if (isProd) throw new Error(`Missing required env var ${name}`);
    return undefined;
  }
  if (min && value.length < min) {
    throw new Error(`Env var ${name} must be at least ${min} characters`);
  }
  return value;
}

// JWT secret: mandatory + strong in prod; a clearly-labelled dev fallback otherwise.
const JWT_SECRET =
  required("JWT_SECRET", { min: 32 }) ||
  (() => {
    console.warn("⚠️  JWT_SECRET not set — using an insecure dev fallback. Do NOT use in production.");
    return "dev-only-insecure-secret-do-not-use-in-production";
  })();

// Allowed CORS origins (comma-separated). Empty in dev = reflect any origin.
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  corsOrigins: CORS_ORIGINS,
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: required("MYSQL_USER") || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: required("MYSQL_DATABASE") || "aidvocate",
    // AWS RDS requires TLS in transit — enable with MYSQL_SSL=true.
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  },
};

export default config;
