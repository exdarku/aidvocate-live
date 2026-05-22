import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const cats = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json(cats);
});

router.get("/event/:eventId", (req, res) => {
  const cats = db.prepare(
    "SELECT c.* FROM categories c JOIN event_categories ec ON ec.categoryId = c.id WHERE ec.eventId = ?"
  ).all(req.params.eventId);
  res.json(cats);
});

router.get("/organization/:organizationId", (req, res) => {
  const cats = db.prepare(
    "SELECT c.* FROM categories c JOIN organization_categories oc ON oc.categoryId = c.id WHERE oc.organizationId = ?"
  ).all(req.params.organizationId);
  res.json(cats);
});

export default router;
