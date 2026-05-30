import { Router } from "express";
import { all } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const ngos = await all("SELECT id, name, description FROM ngos");
  res.json(ngos);
});

export default router;
