import { Router } from "express";
import db from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { buildMerkleTree } from "../services/merkle.js";
import { submitMerkleRoot } from "../services/blockchain.js";

const router = Router();
router.use(authenticate);

router.post("/create", requireRole("ngo"), async (req, res) => {
  try {
    const unbatched = db.prepare(
      "SELECT * FROM donations WHERE batchId IS NULL ORDER BY createdAt"
    ).all();

    if (unbatched.length === 0) {
      return res.status(400).json({ error: "No unbatched donations" });
    }

    const commitments = unbatched.map(d => d.commitment);
    const { root } = await buildMerkleTree(commitments);

    const stmt = db.prepare(
      "INSERT INTO batches (merkleRoot, commitments, status) VALUES (?, ?, 'pending')"
    );
    const result = stmt.run(root, JSON.stringify(commitments));
    const batchId = result.lastInsertRowid;

    const updateStmt = db.prepare("UPDATE donations SET batchId = ? WHERE id = ?");
    for (const d of unbatched) {
      updateStmt.run(batchId, d.id);
    }

    res.status(201).json({
      batchId,
      merkleRoot: root,
      donationCount: unbatched.length,
      status: "pending"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/submit", requireRole("ngo"), async (req, res) => {
  try {
    const batch = db.prepare("SELECT * FROM batches WHERE id = ?").get(req.params.id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.status === "confirmed") {
      return res.status(400).json({ error: "Batch already submitted" });
    }

    const txHash = await submitMerkleRoot(batch.merkleRoot);
    db.prepare("UPDATE batches SET txHash = ?, status = 'confirmed' WHERE id = ?")
      .run(txHash, batch.id);

    res.json({ batchId: batch.id, txHash, status: "confirmed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const batch = db.prepare("SELECT * FROM batches WHERE id = ?").get(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json({ ...batch, commitments: JSON.parse(batch.commitments) });
});

export default router;
