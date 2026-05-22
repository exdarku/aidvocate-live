import { Router } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { authenticate } from "../middleware/auth.js";
import { verifyProofOnChain } from "../services/blockchain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

router.get("/artifacts", (req, res) => {
  res.json({
    wasmUrl: "/api/verify/artifacts/wasm",
    zkeyUrl: "/api/verify/artifacts/zkey",
    vkeyUrl: "/api/verify/artifacts/vkey"
  });
});

router.get("/artifacts/wasm", (req, res) => {
  const wasmPath = join(__dirname, "..", "..", "..", "circuits", "build", "DonationVerifier_js", "DonationVerifier.wasm");
  res.sendFile(wasmPath);
});

router.get("/artifacts/zkey", (req, res) => {
  const zkeyPath = join(__dirname, "..", "..", "..", "circuits", "build", "DonationVerifier.zkey");
  res.sendFile(zkeyPath);
});

router.get("/artifacts/vkey", (req, res) => {
  const vkeyPath = join(__dirname, "..", "..", "..", "circuits", "build", "verification_key.json");
  res.sendFile(vkeyPath);
});

router.post("/on-chain", authenticate, async (req, res) => {
  try {
    const { proof, publicSignals, batchId } = req.body;
    if (!proof || !publicSignals || batchId === undefined) {
      return res.status(400).json({ error: "proof, publicSignals, and batchId required" });
    }

    const valid = await verifyProofOnChain(proof, publicSignals, batchId);
    res.json({ valid, batchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
