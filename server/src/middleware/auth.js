import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "aidvocate-dev-secret";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Like authenticate(), but never rejects: sets req.user if a valid token is
 * present, otherwise leaves req.user undefined and lets the handler decide.
 */
export function tryAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // Invalid token — treat as guest (don't error).
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
}

export { JWT_SECRET };
