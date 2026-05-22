import { Router } from "express";
import crypto from "crypto";
import db from "../db.js";
import { authenticate, tryAuthenticate } from "../middleware/auth.js";
import { computeCommitment, getMerkleProof } from "../services/merkle.js";

const router = Router();

/**
 * POST /api/donations
 * Auth: optional. Authenticated users get the donation linked to their account.
 * Guests can donate by providing { guestName, guestEmail, guestContact, isAnonymous }.
 */
router.post("/", tryAuthenticate, async (req, res) => {
  try {
    const {
      ngoId,
      organizationId,
      eventId,
      amount,
      description,
      guestName,
      guestEmail,
      guestContact,
      isAnonymous,
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid positive amount required" });
    }

    const asGuest = !req.user;
    if (asGuest) {
      const anon = isAnonymous === true || isAnonymous === 1;
      if (!anon && (!guestName || !guestEmail)) {
        return res.status(400).json({
          error: "Guest donations require name + email (or check the Anonymous option).",
        });
      }
    }

    let resolvedNgoId = ngoId;
    if (!resolvedNgoId && organizationId) {
      const org = db.prepare("SELECT ngoId FROM organizations WHERE id = ?").get(organizationId);
      if (org && org.ngoId) resolvedNgoId = org.ngoId;
    }
    if (!resolvedNgoId) {
      const firstNgo = db.prepare("SELECT id FROM ngos LIMIT 1").get();
      if (!firstNgo) return res.status(400).json({ error: "No NGOs configured" });
      resolvedNgoId = firstNgo.id;
    }

    const ngo = db.prepare("SELECT * FROM ngos WHERE id = ?").get(resolvedNgoId);
    if (!ngo) return res.status(404).json({ error: "NGO not found" });

    // Poseidon commitment uses donorId 0 for guest donations — recipient/amount/timestamp/salt still uniquely identify it.
    const donorIdForCommitment = req.user ? req.user.id : 0;
    const timestamp = Math.floor(Date.now() / 1000);
    const salt = BigInt("0x" + crypto.randomBytes(16).toString("hex")).toString();
    const commitment = await computeCommitment(donorIdForCommitment, amount, resolvedNgoId, timestamp, salt);
    // 32-char hex (128 bits of entropy) — unguessable by design.
    // Anyone holding the full reference is treated as authorised to view it.
    const paymentReference = crypto.randomBytes(16).toString("hex");

    const stmt = db.prepare(`
      INSERT INTO donations (
        donorId, ngoId, organizationId, eventId, amount, timestamp, salt, commitment,
        paymentStatus, paymentReference, description,
        guestName, guestEmail, guestContact, isAnonymous
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      req.user ? req.user.id : null,
      resolvedNgoId,
      organizationId || null,
      eventId || null,
      amount,
      timestamp,
      salt,
      commitment,
      paymentReference,
      description || null,
      asGuest ? guestName || null : null,
      asGuest ? guestEmail || null : null,
      asGuest ? guestContact || null : null,
      asGuest && (isAnonymous === true || isAnonymous === 1) ? 1 : 0
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      commitment,
      salt,
      timestamp,
      paymentReference,
      payment_url: `/payment-success?ref=${paymentReference}`,
      asGuest,
      message: "Donation recorded. Save your salt for verification proof.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Receipt lookup. Auth-aware:
 *  - If the request is unauthenticated, the 32-char unguessable reference IS
 *    the bearer credential — anyone holding it can view the receipt.
 *  - If the request IS authenticated, the receipt must belong to that user OR
 *    the user must be the original guest donor. Guards against an attacker
 *    who somehow obtained another user's reference while logged into their
 *    own account.
 * Never exposes donor identity or guest contact info in the response.
 */
router.get("/receipt/:ref", tryAuthenticate, (req, res) => {
  const row = db.prepare(`
    SELECT
      d.id, d.donorId, d.amount, d.timestamp, d.commitment, d.salt,
      d.batchId, d.paymentStatus, d.paymentReference, d.description,
      d.isAnonymous, d.createdAt,
      n.name as ngoName,
      o.name as organizationName,
      e.name as eventName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    LEFT JOIN events e ON d.eventId = e.id
    WHERE d.paymentReference = ?
  `).get(req.params.ref);
  if (!row) return res.status(404).json({ error: "Receipt not found" });

  if (req.user) {
    // Logged-in user may only view their own donations. Guest receipts
    // (donorId IS NULL) are accessible to anyone with the reference.
    if (row.donorId !== null && row.donorId !== req.user.id) {
      return res.status(403).json({ error: "This receipt belongs to another user." });
    }
  }

  // Strip donorId from the response — it's an internal identifier.
  const { donorId, ...publicRow } = row;
  void donorId;
  res.json(publicRow);
});

// Routes below require an authenticated user (they're personal/private).
router.use(authenticate);

router.get("/", (req, res) => {
  const donations = db.prepare(`
    SELECT d.*, n.name as ngoName, o.name as organizationName, e.name as eventName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    LEFT JOIN events e ON d.eventId = e.id
    WHERE d.donorId = ?
    ORDER BY d.createdAt DESC
  `).all(req.user.id);
  res.json(donations);
});

router.get("/by-reference/:ref", (req, res) => {
  const donation = db.prepare(`
    SELECT d.*, n.name as ngoName, o.name as organizationName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    WHERE d.paymentReference = ? AND d.donorId = ?
  `).get(req.params.ref, req.user.id);
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

router.get("/:id", async (req, res) => {
  const donation = db.prepare(`
    SELECT d.*, n.name as ngoName, o.name as organizationName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    WHERE d.id = ? AND d.donorId = ?
  `).get(req.params.id, req.user.id);
  if (!donation) return res.status(404).json({ error: "Donation not found" });

  let merkleProof = null;
  if (donation.batchId) {
    merkleProof = await getMerkleProof(donation.batchId, donation.commitment);
  }
  res.json({ ...donation, merkleProof });
});

export default router;
