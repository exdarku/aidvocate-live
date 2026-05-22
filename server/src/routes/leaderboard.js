import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare(`
    SELECT
      u.id as userId,
      COALESCE(u.firstName || ' ' || u.lastName, u.email) as name,
      COALESCE(u.username, u.email) as username,
      SUM(d.amount) as totalDonated,
      COUNT(d.id) as donationCount
    FROM users u
    INNER JOIN donations d ON d.donorId = u.id
    GROUP BY u.id
    ORDER BY totalDonated DESC
    LIMIT 50
  `).all();

  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  res.json(ranked);
});

export default router;
