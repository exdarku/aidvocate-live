// Measures REAL on-chain gas for the Barretenberg-exported UltraHonk verifier
// (Noir toolchain), completing the verification-gas column of the Phase 0b
// framework benchmark. Uses the keccak-transcript artifacts produced by
// circuits/scripts/docker-noir-pipeline.sh stage 6 (the EVM verifier only
// accepts keccak-oracle proofs, not the default recursion-friendly oracle).
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keccakDir = join(__dirname, "..", "..", "circuits", "noir", "target", "keccak");
const honkVerifier = join(__dirname, "..", "contracts", "HonkVerifierFresh.sol");

describe("Phase 0b: Real on-chain UltraHonk (Noir) verification gas", function () {
  let verifier, proofBytes, publicInputs;

  before(async function () {
    // Requires the Noir pipeline's keccak artifacts; skip gracefully if absent.
    if (!existsSync(join(keccakDir, "proof")) || !existsSync(honkVerifier)) {
      this.skip();
    }
    const network = await hre.network.connect();
    const { ethers } = network;

    // proof: raw bytes; public_inputs: concatenated 32-byte field elements.
    proofBytes = "0x" + readFileSync(join(keccakDir, "proof")).toString("hex");
    const pubRaw = readFileSync(join(keccakDir, "public_inputs"));
    publicInputs = [];
    for (let i = 0; i < pubRaw.length; i += 32) {
      publicInputs.push("0x" + pubRaw.subarray(i, i + 32).toString("hex"));
    }

    verifier = await ethers.deployContract("HonkVerifier");
  });

  it("verifies a real UltraHonk proof on-chain and reports gas", async function () {
    const valid = await verifier.verify(proofBytes, publicInputs);
    console.log(`    HonkVerifier.verify returned: ${valid}`);
    expect(valid).to.equal(true);

    const gas = await verifier.verify.estimateGas(proofBytes, publicInputs);
    console.log(`    verify (UltraHonk) gas: ${gas.toString()}`);
    expect(gas).to.be.greaterThan(0n);
  });

  it("rejects a tampered proof (flipped public input)", async function () {
    const badInput = ["0x" + (BigInt(publicInputs[0]) + 1n).toString(16).padStart(64, "0")];
    // The Honk verifier reverts (e.g. SumcheckFailed) or returns false on a
    // bad input depending on which check trips first — accept either.
    let rejected = false;
    try {
      rejected = (await verifier.verify(proofBytes, badInput)) === false;
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });
});
