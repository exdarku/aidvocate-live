import { Router } from "express";
import { all, get, run } from "../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { buildMerkleTree } from "../services/merkle.js";
import { submitMerkleRoot } from "../services/blockchain.js";

const router = Router();
router.use(authenticate);

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
