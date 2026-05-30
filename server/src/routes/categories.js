import { Router } from "express";
import { all } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const cats = await all("SELECT * FROM categories ORDER BY name");
  res.json(cats);
});

router.get("/event/:eventId", async (req, res) => {
  const cats = await all(
    "SELECT c.* FROM categories c JOIN event_categories ec ON ec.categoryId = c.id WHERE ec.eventId = ?",
    [req.params.eventId]
  );
  res.json(cats);
});

router.get("/organization/:organizationId", async (req, res) => {
  const cats = await all(
    "SELECT c.* FROM categories c JOIN organization_categories oc ON oc.categoryId = c.id WHERE oc.organizationId = ?",
    [req.params.organizationId]
  );
  res.json(cats);
});

export default router;
