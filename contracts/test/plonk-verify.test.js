// Measures REAL on-chain gas for PLONK verification, for comparison against
// the Groth16 verifier (Phase 0b framework benchmark). Uses the artifacts
// produced by circuits/scripts/docker-plonk-pipeline.sh.
//
// The PLONK verifier is exercised directly (not through AidVocate) because
// AidVocate's verifyDonation interface is Groth16-shaped; this test isolates
// the proving-system cost difference, which is what the benchmark compares.
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const plonkDir = join(__dirname, "..", "..", "circuits", "build", "plonk");
const plonkVerifier = join(__dirname, "..", "contracts", "PlonkVerifierFresh.sol");

describe("Phase 0b: Real on-chain PLONK verification gas", function () {
  let verifier, ethers, proofCalldata, pubSignals;

  before(async function () {
    // Requires the PLONK pipeline artifacts (run docker-plonk-pipeline.sh,
    // then copy the exported verifier). Skip gracefully if absent.
    if (!existsSync(join(plonkDir, "calldata.txt")) || !existsSync(plonkVerifier)) {
      this.skip();
    }
    const network = await hre.network.connect();
    ethers = network.ethers;

    // calldata.txt is snarkjs's soliditycalldata output:
    //   ["0x..", ...24 proof words], ["0x.." public signals]
    const raw = readFileSync(join(plonkDir, "calldata.txt"), "utf8").trim();
    const parsed = JSON.parse(`[${raw}]`);
    [proofCalldata, pubSignals] = parsed;
    expect(proofCalldata).to.have.lengthOf(24); // 9 G1 points + 6 evaluations

    verifier = await ethers.deployContract("PlonkVerifierFresh");
  });

  it("verifies a real PLONK proof on-chain and reports gas", async function () {
    // The generated verifier is a view function, so measure via estimateGas
    // (no event-emitting wrapper exists for PLONK; this is the raw
    // pairing/KZG verification cost).
    const valid = await verifier.verifyProof(proofCalldata, pubSignals);
    console.log(`    PlonkVerifier.verifyProof returned: ${valid}`);
    expect(valid).to.equal(true);

    const gas = await verifier.verifyProof.estimateGas(proofCalldata, pubSignals);
    console.log(`    verifyProof (real PLONK) gas: ${gas.toString()}`);
    expect(gas).to.be.greaterThan(0n);
  });

  it("rejects a tampered PLONK proof (flipped public signal)", async function () {
    const badSignal = [(BigInt(pubSignals[0]) + 1n).toString()];
    const valid = await verifier.verifyProof(proofCalldata, badSignal);
    expect(valid).to.equal(false);
  });
});
