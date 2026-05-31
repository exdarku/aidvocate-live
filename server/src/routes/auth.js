import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { get, run } from "../db.js";
import { JWT_SECRET, authenticate } from "../middleware/auth.js";
import { config } from "../config.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: config.jwtExpiresIn,
  });
}

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  // NOTE: role is intentionally NOT accepted here — every self-registration is a
  // donor. Elevated roles (ngo) are granted out-of-band, never by the client.
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  username: z.string().trim().max(100).optional(),
  contactNumber: z.string().trim().max(20).optional(),
  dob: z.string().trim().max(40).optional(),
  location: z.string().trim().max(100).optional(),
  interestedIn: z.string().trim().max(100).optional(),
});

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, username, contactNumber, dob, location, interestedIn } = req.body;

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    const result = await run(
      `INSERT INTO users (email, passwordHash, role, firstName, lastName, username, contactNumber, dob, location, interestedIn)
       VALUES (?, ?, 'donor', ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, passwordHash,
        firstName || null, lastName || null, username || null,
        contactNumber || null, dob || null, location || null, interestedIn || null,
      ]
    );

    const user = {
      id: result.insertId,
      email, role: "donor",
      firstName: firstName || null, lastName: lastName || null,
      username: username || null,
    };

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return next(new HttpError(409, "Email already registered"));
    }
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    // Always run a compare to keep timing roughly constant whether or not the
    // user exists, then return an identical message either way.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    if (!user || !valid) return next(new HttpError(401, "Wrong credentials"));

    res.json({
      token: signToken(user),
      user: {
        id: user.id, email: user.email, role: user.role,
        firstName: user.firstName, lastName: user.lastName, username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res) => {
  const u = await get("SELECT id, email, role, firstName, lastName, username, contactNumber, dob, location, interestedIn FROM users WHERE id = ?", [req.user.id]);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(u);
});

router.get("/authenticated", authenticate, async (req, res) => {
  const u = await get("SELECT id, email, role, firstName, lastName, username FROM users WHERE id = ?", [req.user.id]);
  res.json({ authenticated: true, user: u });
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out (client must discard token)" });
});

export default router;
