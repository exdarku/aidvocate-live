import { Router } from "express";
import { all } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  // Public endpoint — never expose email or any PII. Fall back to a generic
  // label rather than the user's email when no display name is set.
  const rows = await all(`
    SELECT
      u.id as userId,
      NULLIF(TRIM(CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, ''))), '') as fullName,
      u.username as username,
      SUM(d.amount) as totalDonated,
      COUNT(d.id) as donationCount
    FROM users u
    INNER JOIN donations d ON d.donorId = u.id
    GROUP BY u.id
    ORDER BY totalDonated DESC
    LIMIT 50
  `);

  const ranked = rows.map((r, i) => ({
    userId: r.userId,
    name: r.fullName || r.username || "Anonymous donor",
    username: r.username || "anonymous",
    totalDonated: r.totalDonated,
    donationCount: r.donationCount,
    rank: i + 1,
  }));
  res.json(ranked);
});

export default router;
