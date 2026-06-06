// Measures REAL on-chain gas for Groth16 verification (not the MockVerifier).
// Uses the proof artifacts produced by circuits/scripts/docker-zk-pipeline.sh.
//
// This is the only suite that exercises actual cryptography end-to-end:
// a snarkjs-generated proof is checked by the real verifier contract via
// the EVM's elliptic-curve pairing precompiles. It fills in TC-07/08/09,
// which integration.test.js could only cover with a mock.
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Resolve paths relative to this file (ESM has no __dirname built in).
const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, "..", "..", "circuits", "build");
const freshVerifier = join(__dirname, "..", "contracts", "Groth16VerifierFresh.sol");

describe("Phase 2a: Real on-chain Groth16 verification gas", function () {
  let aidvocate, ethers, proof, pub, rootBytes;

  before(async function () {
    // These require the ZK pipeline artifacts (run circuits/scripts/docker-zk-pipeline.sh
    // then export the matching verifier). Skip gracefully if absent so the
    // rest of the test suite still runs on machines without Docker/circom.
    if (!existsSync(join(buildDir, "proof.json")) || !existsSync(freshVerifier)) {
      this.skip();
    }
    const network = await hre.network.connect();
    ethers = network.ethers;

    // proof.json = the Groth16 proof points; public.json = the public
    // signals (here just [merkleRoot]). Both come from snarkjs.
    proof = JSON.parse(readFileSync(join(buildDir, "proof.json"), "utf8"));
    pub = JSON.parse(readFileSync(join(buildDir, "public.json"), "utf8"));
    rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(pub[0])), 32);

    // Deploy the REAL verifier (exported from the same trusted setup that
    // produced the proof — verifier and proof must match or verification fails).
    const verifier = await ethers.deployContract("Groth16VerifierFresh");
    aidvocate = await ethers.deployContract("AidVocate", [await verifier.getAddress()]);
  });

  // Convert snarkjs proof format to the verifier's calldata layout.
  // Note the pi_b coordinate swap: snarkjs outputs G2 points as [x0,x1] but
  // the Solidity verifier expects [x1,x0] (standard snarkjs->EVM convention).
  function calldata() {
    return [
      [proof.pi_a[0], proof.pi_a[1]],
      [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      [proof.pi_c[0], proof.pi_c[1]],
      [pub[0]],
    ];
  }

  it("stores the batch root (gas)", async function () {
    // Store the root the proof was generated against (becomes batch 0).
    // Logged gas figure feeds the evaluation in docs/EVALUATION.md.
    const tx = await aidvocate.storeMerkleRoot(rootBytes);
    const r = await tx.wait();
    console.log(`    storeMerkleRoot gas: ${r.gasUsed.toString()}`);
    expect(r.status).to.equal(1);
  });

  it("verifies a real proof on-chain and reports gas", async function () {
    const [pA, pB, pC, signals] = calldata();
    // Static call first to confirm the proof actually verifies (we get the
    // boolean return value without mining a transaction).
    const valid = await aidvocate.verifyDonation.staticCall(pA, pB, pC, signals, 0);
    console.log(`    verifyDonation returned: ${valid}`);
    expect(valid).to.equal(true);

    // Then a real tx to measure gas — verifyDonation emits an event, so it's
    // not a view function and gasUsed includes the full pairing check
    // (~200k+ gas dominated by the ecPairing precompile).
    const tx = await aidvocate.verifyDonation(pA, pB, pC, signals, 0);
    const r = await tx.wait();
    console.log(`    verifyDonation (real Groth16) gas: ${r.gasUsed.toString()}`);
    expect(r.status).to.equal(1);
  });

  it("rejects a tampered proof (flipped public signal)", async function () {
    const [pA, pB, pC] = calldata();
    // Store root+1 as batch 1, then submit the (valid) proof whose public
    // signal is the ORIGINAL root — simulates pointing a proof at a batch
    // it doesn't belong to.
    const badRoot = ethers.zeroPadValue(ethers.toBeHex(BigInt(pub[0]) + 1n), 32);
    await aidvocate.storeMerkleRoot(badRoot); // batch 1
    // Public signal no longer matches the stored root -> the contract's
    // require() reverts before the verifier is even consulted.
    await expect(
      aidvocate.verifyDonation(pA, pB, pC, [pub[0]], 1)
    ).to.be.revertedWith("Public signal does not match stored root");
  });
});
