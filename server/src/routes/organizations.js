import { Router } from "express";
import { all, get, run } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

async function attachCategoriesAndCounts(org) {
  const cats = (
    await all(
      "SELECT c.name FROM categories c JOIN organization_categories oc ON oc.categoryId = c.id WHERE oc.organizationId = ?",
      [org.id]
    )
  ).map((r) => r.name);
  const { n: likeCount } = await get("SELECT COUNT(*) as n FROM organization_likes WHERE organizationId = ?", [org.id]);
  const { n: volunteerCount } = await get("SELECT COUNT(*) as n FROM organization_volunteers WHERE organizationId = ?", [org.id]);
  const { t: totalRaised } = await get("SELECT COALESCE(SUM(amount), 0) as t FROM donations WHERE organizationId = ?", [org.id]);
  return { ...org, categories: cats, likeCount, volunteerCount, totalRaised };
}

router.get("/", async (req, res) => {
  const orgs = await all("SELECT * FROM organizations ORDER BY id");
  res.json(await Promise.all(orgs.map(attachCategoriesAndCounts)));
});

router.get("/:id", async (req, res) => {
  const org = await get("SELECT * FROM organizations WHERE id = ?", [req.params.id]);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  res.json(await attachCategoriesAndCounts(org));
});

router.get("/:id/events", async (req, res) => {
  const events = await all("SELECT * FROM events WHERE organizationId = ? ORDER BY dateStart", [req.params.id]);
  res.json(events);
});

router.post("/:id/like", authenticate, async (req, res) => {
  await run("INSERT IGNORE INTO organization_likes (userId, organizationId) VALUES (?, ?)", [req.user.id, req.params.id]);
  res.json({ liked: true });
});

router.delete("/:id/like", authenticate, async (req, res) => {
  await run("DELETE FROM organization_likes WHERE userId = ? AND organizationId = ?", [req.user.id, req.params.id]);
  res.json({ liked: false });
});

router.get("/:id/liked", authenticate, async (req, res) => {
  const row = await get("SELECT 1 as x FROM organization_likes WHERE userId = ? AND organizationId = ?", [req.user.id, req.params.id]);
  res.json({ liked: !!row });
});

router.post("/:id/volunteer", authenticate, async (req, res) => {
  await run("INSERT IGNORE INTO organization_volunteers (userId, organizationId) VALUES (?, ?)", [req.user.id, req.params.id]);
  res.json({ volunteered: true });
});

router.delete("/:id/volunteer", authenticate, async (req, res) => {
  await run("DELETE FROM organization_volunteers WHERE userId = ? AND organizationId = ?", [req.user.id, req.params.id]);
  res.json({ volunteered: false });
});

router.get("/:id/volunteered", authenticate, async (req, res) => {
  const row = await get("SELECT 1 as x FROM organization_volunteers WHERE userId = ? AND organizationId = ?", [req.user.id, req.params.id]);
  res.json({ volunteered: !!row });
});

export default router;
