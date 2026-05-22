import { Router } from "express";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

function attachEventMeta(ev) {
  const cats = db.prepare(
    "SELECT c.name FROM categories c JOIN event_categories ec ON ec.categoryId = c.id WHERE ec.eventId = ?"
  ).all(ev.id).map(r => r.name);
  const likeCount = db.prepare("SELECT COUNT(*) as n FROM event_likes WHERE eventId = ?").get(ev.id).n;
  const volunteerCount = db.prepare("SELECT COUNT(*) as n FROM event_volunteers WHERE eventId = ?").get(ev.id).n;
  const org = db.prepare("SELECT id, name FROM organizations WHERE id = ?").get(ev.organizationId);
  return { ...ev, categories: cats, likeCount, volunteerCount, organization: org };
}

router.get("/", (req, res) => {
  const events = db.prepare("SELECT * FROM events ORDER BY dateStart").all();
  res.json(events.map(attachEventMeta));
});

router.get("/upcoming", (req, res) => {
  const nowIso = new Date().toISOString();
  const events = db.prepare("SELECT * FROM events WHERE dateStart >= ? ORDER BY dateStart").all(nowIso);
  res.json(events.map(attachEventMeta));
});

router.get("/:id", (req, res) => {
  const ev = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!ev) return res.status(404).json({ error: "Event not found" });
  res.json(attachEventMeta(ev));
});

router.post("/:id/like", authenticate, (req, res) => {
  db.prepare("INSERT OR IGNORE INTO event_likes (userId, eventId) VALUES (?, ?)").run(req.user.id, req.params.id);
  res.json({ liked: true });
});

router.delete("/:id/like", authenticate, (req, res) => {
  db.prepare("DELETE FROM event_likes WHERE userId = ? AND eventId = ?").run(req.user.id, req.params.id);
  res.json({ liked: false });
});

router.get("/:id/liked", authenticate, (req, res) => {
  const row = db.prepare("SELECT 1 FROM event_likes WHERE userId = ? AND eventId = ?").get(req.user.id, req.params.id);
  res.json({ liked: !!row });
});

router.post("/:id/volunteer", authenticate, (req, res) => {
  db.prepare("INSERT OR IGNORE INTO event_volunteers (userId, eventId) VALUES (?, ?)").run(req.user.id, req.params.id);
  res.json({ volunteered: true });
});

router.delete("/:id/volunteer", authenticate, (req, res) => {
  db.prepare("DELETE FROM event_volunteers WHERE userId = ? AND eventId = ?").run(req.user.id, req.params.id);
  res.json({ volunteered: false });
});

export default router;
