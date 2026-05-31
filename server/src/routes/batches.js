import { Router } from "express";
import { all, get, run } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { buildMerkleTree } from "../services/merkle.js";
import { submitMerkleRoot } from "../services/blockchain.js";

const router = Router();
router.use(authenticate);

/**
 * GET /api/batches — list every batch with its donation count + total amount.
 * NGO-only: this is the batch-management overview.
 */
router.get("/", requireRole("ngo"), async (req, res) => {
  const batches = await all(`
    SELECT
      b.id, b.merkleRoot, b.txHash, b.status, b.createdAt,
      (SELECT COUNT(*) FROM donations d WHERE d.batchId = b.id) AS donationCount,
      (SELECT COALESCE(SUM(d.amount), 0) FROM donations d WHERE d.batchId = b.id) AS totalAmount
    FROM batches b
    ORDER BY b.id DESC
  `);
  res.json(batches);
});

/**
 * GET /api/batches/unbatched — donations not yet assigned to a batch, i.e. the
 * ones the next "Create batch" will sweep up. NGO-only. Defined before "/:id"
 * so the literal path isn't captured as an id.
 */
router.get("/unbatched", requireRole("ngo"), async (req, res) => {
  const donations = await all(`
    SELECT
      d.id, d.amount, d.createdAt, d.paymentReference,
      n.name AS ngoName, o.name AS organizationName, e.name AS eventName
    FROM donations d
    JOIN ngos n ON d.ngoId = n.id
    LEFT JOIN organizations o ON d.organizationId = o.id
    LEFT JOIN events e ON d.eventId = e.id
    WHERE d.batchId IS NULL
    ORDER BY d.createdAt DESC
  `);
  res.json(donations);
});

router.post("/create", requireRole("ngo"), async (req, res) => {
  const unbatched = await all("SELECT * FROM donations WHERE batchId IS NULL ORDER BY createdAt");

  if (unbatched.length === 0) {
    return res.status(400).json({ error: "No unbatched donations" });
  }

  const commitments = unbatched.map((d) => d.commitment);
  const { root } = await buildMerkleTree(commitments);

  const result = await run(
    "INSERT INTO batches (merkleRoot, commitments, status) VALUES (?, ?, 'pending')",
    [root, JSON.stringify(commitments)]
  );
  const batchId = result.insertId;

  // Assign every donation we just batched in a single statement (mysql2 expands
  // the array into the IN list).
  const ids = unbatched.map((d) => d.id);
  await run("UPDATE donations SET batchId = ? WHERE id IN (?)", [batchId, ids]);

  res.status(201).json({
    batchId,
    merkleRoot: root,
    donationCount: unbatched.length,
    status: "pending",
  });
});

router.post("/:id/submit", requireRole("ngo"), async (req, res) => {
  const batch = await get("SELECT * FROM batches WHERE id = ?", [req.params.id]);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  if (batch.status === "confirmed") {
    return res.status(400).json({ error: "Batch already submitted" });
  }

  const txHash = await submitMerkleRoot(batch.merkleRoot);
  await run("UPDATE batches SET txHash = ?, status = 'confirmed' WHERE id = ?", [txHash, batch.id]);

  res.json({ batchId: batch.id, txHash, status: "confirmed" });
});

router.get("/:id", async (req, res) => {
  const batch = await get("SELECT * FROM batches WHERE id = ?", [req.params.id]);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json({ ...batch, commitments: JSON.parse(batch.commitments) });
});

export default router;
