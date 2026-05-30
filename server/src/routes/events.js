import { Router } from "express";
import { all, get, run } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

async function attachEventMeta(ev) {
  const cats = (
    await all(
      "SELECT c.name FROM categories c JOIN event_categories ec ON ec.categoryId = c.id WHERE ec.eventId = ?",
      [ev.id]
    )
  ).map((r) => r.name);
  const { n: likeCount } = await get("SELECT COUNT(*) as n FROM event_likes WHERE eventId = ?", [ev.id]);
  const { n: volunteerCount } = await get("SELECT COUNT(*) as n FROM event_volunteers WHERE eventId = ?", [ev.id]);
  const org = await get("SELECT id, name FROM organizations WHERE id = ?", [ev.organizationId]);
  return { ...ev, categories: cats, likeCount, volunteerCount, organization: org };
}

router.get("/", async (req, res) => {
  const events = await all("SELECT * FROM events ORDER BY dateStart");
  res.json(await Promise.all(events.map(attachEventMeta)));
});

router.get("/upcoming", async (req, res) => {
  const nowIso = new Date().toISOString();
  const events = await all("SELECT * FROM events WHERE dateStart >= ? ORDER BY dateStart", [nowIso]);
  res.json(await Promise.all(events.map(attachEventMeta)));
});

router.get("/:id", async (req, res) => {
  const ev = await get("SELECT * FROM events WHERE id = ?", [req.params.id]);
  if (!ev) return res.status(404).json({ error: "Event not found" });
  res.json(await attachEventMeta(ev));
});

router.post("/:id/like", authenticate, async (req, res) => {
  await run("INSERT IGNORE INTO event_likes (userId, eventId) VALUES (?, ?)", [req.user.id, req.params.id]);
  res.json({ liked: true });
});

router.delete("/:id/like", authenticate, async (req, res) => {
  await run("DELETE FROM event_likes WHERE userId = ? AND eventId = ?", [req.user.id, req.params.id]);
  res.json({ liked: false });
});

router.get("/:id/liked", authenticate, async (req, res) => {
  const row = await get("SELECT 1 as x FROM event_likes WHERE userId = ? AND eventId = ?", [req.user.id, req.params.id]);
  res.json({ liked: !!row });
});

router.post("/:id/volunteer", authenticate, async (req, res) => {
  await run("INSERT IGNORE INTO event_volunteers (userId, eventId) VALUES (?, ?)", [req.user.id, req.params.id]);
  res.json({ volunteered: true });
});

router.delete("/:id/volunteer", authenticate, async (req, res) => {
  await run("DELETE FROM event_volunteers WHERE userId = ? AND eventId = ?", [req.user.id, req.params.id]);
  res.json({ volunteered: false });
});

export default router;
