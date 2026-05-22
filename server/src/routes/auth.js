import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";
import { JWT_SECRET, authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const {
      email, password, role,
      firstName, lastName, username,
      contactNumber, dob, location, interestedIn
    } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const validRole = role === "ngo" ? "ngo" : "donor";
    const passwordHash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (email, passwordHash, role, firstName, lastName, username, contactNumber, dob, location, interestedIn)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      email, passwordHash, validRole,
      firstName || null, lastName || null, username || null,
      contactNumber || null, dob || null, location || null, interestedIn || null
    );

    const user = {
      id: result.lastInsertRowid,
      email, role: validRole,
      firstName: firstName || null, lastName: lastName || null,
      username: username || null
    };

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: {
        id: user.id, email: user.email, role: user.role,
        firstName: user.firstName, lastName: user.lastName, username: user.username
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", authenticate, (req, res) => {
  const u = db.prepare("SELECT id, email, role, firstName, lastName, username, contactNumber, dob, location, interestedIn FROM users WHERE id = ?").get(req.user.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(u);
});

router.get("/authenticated", authenticate, (req, res) => {
  const u = db.prepare("SELECT id, email, role, firstName, lastName, username FROM users WHERE id = ?").get(req.user.id);
  res.json({ authenticated: true, user: u });
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out (client must discard token)" });
});

export default router;
