import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import donationRoutes from "./routes/donations.js";
import batchRoutes from "./routes/batches.js";
import verifyRoutes from "./routes/verify.js";
import ngoRoutes from "./routes/ngos.js";
import organizationRoutes from "./routes/organizations.js";
import eventRoutes from "./routes/events.js";
import categoryRoutes from "./routes/categories.js";
import leaderboardRoutes from "./routes/leaderboard.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/ngos", ngoRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`AidVocate API running on http://localhost:${PORT}`);
});
