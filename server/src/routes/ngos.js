import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const ngos = db.prepare("SELECT id, name, description FROM ngos").all();
  res.json(ngos);
});

export default router;
