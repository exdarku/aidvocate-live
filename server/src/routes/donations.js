import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { all, get, run } from "../db.js";
import { authenticate, tryAuthenticate } from "../middleware/auth.js";
import { computeCommitment, getMerkleProof } from "../services/merkle.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const createDonationSchema = z.object({
  ngoId: z.coerce.number().int().positive().optional(),
  organizationId: z.coerce.number().int().positive().optional(),
  eventId: z.coerce.number().int().positive().optional(),
  // Positive, finite, and bounded — guards against NaN, strings, and absurd values.
  amount: z.coerce.number().positive().max(1_000_000_000),
  description: z.string().trim().max(1000).optional(),
  guestName: z.string().trim().max(200).optional(),
  guestEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  guestContact: z.string().trim().max(50).optional(),
  isAnonymous: z.coerce.boolean().optional(),
});

/**
 * POST /api/donations
 * Auth: optional. Authenticated users get the donation linked to their account.
 * Guests can donate by providing { guestName, guestEmail, guestContact, isAnonymous }.
 */
router.post("/", tryAuthenticate, validateBody(createDonationSchema), async (req, res, next) => {
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
      const org = await get("SELECT ngoId FROM organizations WHERE id = ?", [organizationId]);
      if (org && org.ngoId) resolvedNgoId = org.ngoId;
    }
    if (!resolvedNgoId) {
      const firstNgo = await get("SELECT id FROM ngos LIMIT 1");
      if (!firstNgo) return res.status(400).json({ error: "No NGOs configured" });
      resolvedNgoId = firstNgo.id;
    }

    const ngo = await get("SELECT * FROM ngos WHERE id = ?", [resolvedNgoId]);
    if (!ngo) return res.status(404).json({ error: "NGO not found" });

    // Poseidon commitment uses donorId 0 for guest donations — recipient/amount/timestamp/salt still uniquely identify it.
    const donorIdForCommitment = req.user ? req.user.id : 0;
    const timestamp = Math.floor(Date.now() / 1000);
    const salt = BigInt("0x" + crypto.randomBytes(16).toString("hex")).toString();
    const commitment = await computeCommitment(donorIdForCommitment, amount, resolvedNgoId, timestamp, salt);
    // 32-char hex (128 bits of entropy) — unguessable by design.
    // Anyone holding the full reference is treated as authorised to view it.
    const paymentReference = crypto.randomBytes(16).toString("hex");

    const result = await run(
      `INSERT INTO donations (
        donorId, ngoId, organizationId, eventId, amount, timestamp, salt, commitment,
        paymentStatus, paymentReference, description,
        guestName, guestEmail, guestContact, isAnonymous
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?)`,
      [
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
        asGuest && (isAnonymous === true || isAnonymous === 1) ? 1 : 0,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      commitment,
      salt,
      timestamp,
      paymentReference,
      payment_url: `/payment-success?ref=${paymentReference}`,
      asGuest,
      message: "Donation recorded. Save your salt for verification proof.",
    });
  } catch (err) {
    next(err);
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
router.get("/receipt/:ref", tryAuthenticate, async (req, res) => {
  const row = await get(`
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
  `, [req.params.ref]);
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

router.get("/", async (req, res) => {
  const donations = await all(`
    SELECT d.*, n.name as ngoName, o.name as organizationName, e.name as eventName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    LEFT JOIN events e ON d.eventId = e.id
    WHERE d.donorId = ?
    ORDER BY d.createdAt DESC
  `, [req.user.id]);
  res.json(donations);
});

router.get("/by-reference/:ref", async (req, res) => {
  const donation = await get(`
    SELECT d.*, n.name as ngoName, o.name as organizationName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    WHERE d.paymentReference = ? AND d.donorId = ?
  `, [req.params.ref, req.user.id]);
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

router.get("/:id", async (req, res) => {
  const donation = await get(`
    SELECT d.*, n.name as ngoName, o.name as organizationName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    WHERE d.id = ? AND d.donorId = ?
  `, [req.params.id, req.user.id]);
  if (!donation) return res.status(404).json({ error: "Donation not found" });

  let merkleProof = null;
  if (donation.batchId) {
    merkleProof = await getMerkleProof(donation.batchId, donation.commitment);
  }
  res.json({ ...donation, merkleProof });
});

export default router;
