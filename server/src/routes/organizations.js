import { Router } from "express";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

function attachCategoriesAndCounts(org) {
  const cats = db.prepare(
    "SELECT c.name FROM categories c JOIN organization_categories oc ON oc.categoryId = c.id WHERE oc.organizationId = ?"
  ).all(org.id).map(r => r.name);
  const likeCount = db.prepare("SELECT COUNT(*) as n FROM organization_likes WHERE organizationId = ?").get(org.id).n;
  const volunteerCount = db.prepare("SELECT COUNT(*) as n FROM organization_volunteers WHERE organizationId = ?").get(org.id).n;
  const totalRaised = db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM donations WHERE organizationId = ?").get(org.id).t;
  return { ...org, categories: cats, likeCount, volunteerCount, totalRaised };
}

router.get("/", (req, res) => {
  const orgs = db.prepare("SELECT * FROM organizations ORDER BY id").all();
  res.json(orgs.map(attachCategoriesAndCounts));
});

router.get("/:id", (req, res) => {
  const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(req.params.id);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  res.json(attachCategoriesAndCounts(org));
});

router.get("/:id/events", (req, res) => {
  const events = db.prepare("SELECT * FROM events WHERE organizationId = ? ORDER BY dateStart").all(req.params.id);
  res.json(events);
});

router.post("/:id/like", authenticate, (req, res) => {
  try {
    db.prepare("INSERT OR IGNORE INTO organization_likes (userId, organizationId) VALUES (?, ?)").run(req.user.id, req.params.id);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/like", authenticate, (req, res) => {
  db.prepare("DELETE FROM organization_likes WHERE userId = ? AND organizationId = ?").run(req.user.id, req.params.id);
  res.json({ liked: false });
});

router.get("/:id/liked", authenticate, (req, res) => {
  const row = db.prepare("SELECT 1 FROM organization_likes WHERE userId = ? AND organizationId = ?").get(req.user.id, req.params.id);
  res.json({ liked: !!row });
});

router.post("/:id/volunteer", authenticate, (req, res) => {
  db.prepare("INSERT OR IGNORE INTO organization_volunteers (userId, organizationId) VALUES (?, ?)").run(req.user.id, req.params.id);
  res.json({ volunteered: true });
});

router.delete("/:id/volunteer", authenticate, (req, res) => {
  db.prepare("DELETE FROM organization_volunteers WHERE userId = ? AND organizationId = ?").run(req.user.id, req.params.id);
  res.json({ volunteered: false });
});

router.get("/:id/volunteered", authenticate, (req, res) => {
  const row = db.prepare("SELECT 1 FROM organization_volunteers WHERE userId = ? AND organizationId = ?").get(req.user.id, req.params.id);
  res.json({ volunteered: !!row });
});

export default router;
