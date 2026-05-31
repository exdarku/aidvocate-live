import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { config } from "./config.js";
import { closeDb, get } from "./db.js";
import { checkS3Connection } from "./services/s3.js";
import { notFound, errorHandler } from "./middleware/error.js";

import authRoutes from "./routes/auth.js";
import donationRoutes from "./routes/donations.js";
import batchRoutes from "./routes/batches.js";
import verifyRoutes from "./routes/verify.js";
import ngoRoutes from "./routes/ngos.js";
import organizationRoutes from "./routes/organizations.js";
import eventRoutes from "./routes/events.js";
import categoryRoutes from "./routes/categories.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import mediaRoutes from "./routes/media.js";

const app = express();

// Behind a proxy/load balancer (most PaaS) so rate-limit sees the real client IP.
app.set("trust proxy", 1);

// Security headers.
app.use(helmet());

// CORS: in production, only the configured origins may call the API; in dev,
// reflect any origin so localhost:5173 etc. work without configuration.
app.use(
  cors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  })
);

// Cap request bodies — the API only ever receives small JSON payloads.
app.use(express.json({ limit: "100kb" }));

// Global rate limit, plus a stricter limit on auth to blunt brute-force.
app.use(
  "/api",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false })
);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/ngos", ngoRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/media", mediaRoutes);

app.get("/api/health", async (req, res) => {
  // Probe the DB so the check fails if the database is unreachable.
  try {
    await get("SELECT 1 AS ok");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", timestamp: new Date().toISOString() });
  }
});

// 404 + centralised error handler must come last.
app.use(notFound);
app.use(errorHandler);

// The schema is managed by `npm run db:migrate` (a deploy step), not on boot,
// so the app never races on DDL. Just start listening — the pool connects lazily.
const server = app.listen(config.port, () => {
  console.log(`AidVocate API running on http://localhost:${config.port}`);

  // S3 is optional — probe it and log status, but never block/crash startup.
  checkS3Connection().then((s3) => {
    if (!s3.configured) {
      console.log("ℹ️  S3: not configured (media uploads disabled).");
    } else if (s3.ok) {
      console.log(`✅ S3: connected to bucket "${s3.bucket}" (${s3.region}).`);
    } else {
      console.warn(`⚠️  S3: configured but NOT reachable — ${s3.error}`);
    }
  });
});

// Graceful shutdown so in-flight requests finish before the process exits.
function shutdown(signal) {
  console.log(`${signal} received — shutting down.`);
  const done = () => closeDb().finally(() => process.exit(0));
  if (server) server.close(done);
  else done();
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
