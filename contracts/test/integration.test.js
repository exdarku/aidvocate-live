// Phase 2a integration tests — walks the full test-case matrix (TC-01..TC-10)
// from the evaluation plan against a single shared deployment.
//
// What's real here: Poseidon hashing + Merkle tree construction (circomlibjs,
// the same hash the circom circuit uses) and the contract's storage/access
// logic. What's mocked: the Groth16 verifier (always accepts), so anything
// proof-shaped is checking calldata plumbing, not cryptography. TC-07 checks
// the real circuit/proof artifacts from the ZK pipeline; real on-chain proof
// verification lives in onchain-verify.test.js.
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ZK pipeline artifacts (produced by circuits/scripts/docker-zk-pipeline.sh)
// used by TC-07 to verify the circuit compiled and a proof was generated.
const __dirname = dirname(fileURLToPath(import.meta.url));
const zkBuildDir = join(__dirname, "..", "..", "circuits", "build");

describe("Phase 2a: Functional Tests (TC-01 to TC-10)", function () {
  // Generous timeout: buildPoseidon() does WASM setup and tree hashing in JS.
  this.timeout(120000);

  let aidvocate, mockVerifier, owner, other;
  let poseidon, F;
  let ethers;

  // A fixed sample donation. The commitment scheme hashes these five fields;
  // the random salt is what prevents brute-forcing a donor's identity from
  // the public commitment.
  const testDonation = {
    donorId: 12345n,
    amount: 100000n,    // in smallest currency unit
    ngoId: 1n,
    timestamp: 1709420400n,
    salt: 98765432101234567890n
  };

  // One deployment shared across all tests (before, not beforeEach) — the
  // TC-xx tests build on each other, e.g. TC-07 asserts batchCount > 0
  // because earlier tests already stored roots.
  before(async function () {
    const network = await hre.network.connect();
    ethers = network.ethers;

    // circomlibjs Poseidon returns field elements; F is the finite-field
    // helper used to convert them to decimal strings.
    poseidon = await buildPoseidon();
    F = poseidon.F;

    [owner, other] = await ethers.getSigners();

    mockVerifier = await ethers.deployContract("MockVerifier");
    aidvocate = await ethers.deployContract("AidVocate", [await mockVerifier.getAddress()]);
  });

  it("TC-01: Generate deterministic commitment using Poseidon", async function () {
    // commitment = Poseidon(donorId, amount, ngoId, timestamp, salt).
    // Determinism matters because the donor must be able to re-derive the
    // exact same commitment later to prove their donation is in a batch.
    const hash = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);
    const commitment = F.toString(hash);
    expect(commitment).to.be.a("string");
    expect(commitment.length).to.be.greaterThan(0);

    // Verify determinism: same inputs -> identical commitment.
    const hash2 = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);
    expect(F.toString(hash2)).to.equal(commitment);
  });

  it("TC-02: Store Merkle root on-chain", async function () {
    const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
    await aidvocate.storeMerkleRoot(root);
    const stored = await aidvocate.getMerkleRoot(0);
    expect(stored).to.equal(root);
  });

  it("TC-03: Verify valid commitment via Merkle proof", async function () {
    // End-to-end happy path (with mocked crypto):
    // commitment -> tiny Merkle tree -> root on-chain -> verifyDonation passes.

    // Compute commitment
    const hash = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);
    const commitment = F.toString(hash);

    // Build the smallest possible Merkle tree (depth 1): our commitment on
    // the left, a zero-leaf hash as its sibling on the right.
    const sibling = F.toString(poseidon([0n, 0n]));
    const root = F.toString(poseidon([BigInt(commitment), BigInt(sibling)]));

    // Store root on-chain. The root is a field element (decimal string), so
    // convert to a left-padded 32-byte hex value for the bytes32 parameter.
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
    await aidvocate.storeMerkleRoot(rootBytes);

    // Verify against the batch we just created (batchIds are 0-based).
    const batchId = (await aidvocate.batchCount()) - 1n;
    const pubSignals = [BigInt(root)];

    // MockVerifier always returns true, so the verification should pass.
    // The contract still checks pubSignals[0] matches the stored root —
    // that's the assertion under test. staticCall avoids sending a tx since
    // we only care about the return value.
    const result = await aidvocate.verifyDonation.staticCall(
      [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n],
      [BigInt("0x" + rootBytes.slice(2))],
      batchId
    );
    expect(result).to.equal(true);
  });

  it("TC-04: Reject invalid commitment", async function () {
    // Try to verify against a non-existent batch — the contract must revert
    // before even consulting the verifier.
    await expect(
      aidvocate.verifyDonation(
        [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [0n], 999n
      )
    ).to.be.revertedWith("Batch does not exist");
  });

  it("TC-05: Detect tampered donation data", async function () {
    // Tamper-evidence property of the commitment: changing ANY field of the
    // donation produces a completely different hash, so a tampered record
    // can never match the commitment that went into the Merkle tree.
    const hash1 = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);

    // Tamper: change amount (100000 -> 999999), keep everything else.
    const hash2 = poseidon([
      testDonation.donorId, 999999n,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);

    expect(F.toString(hash1)).to.not.equal(F.toString(hash2));
  });

  it("TC-06: Batch commitments into Merkle tree", async function () {
    // The core scalability idea: N donations are batched off-chain into one
    // Merkle tree, and only the single 32-byte root goes on-chain.

    // Create 10 commitments simulating 10 distinct donations.
    const commitments = [];
    for (let i = 0; i < 10; i++) {
      const hash = poseidon([
        BigInt(i + 1), BigInt((i + 1) * 100),   // donorId, amount
        1n, testDonation.timestamp, BigInt(i * 111111)  // ngoId, timestamp, salt
      ]);
      commitments.push(F.toString(hash));
    }

    // Pad with zero-leaves to 16 — a Merkle tree needs a power-of-2 leaf
    // count (16 = depth 4).
    while (commitments.length < 16) {
      commitments.push("0");
    }

    // Build the tree bottom-up: hash adjacent pairs to form each parent
    // level until a single root remains.
    let level = commitments;
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const hash = poseidon([BigInt(level[i]), BigInt(level[i + 1])]);
        next.push(F.toString(hash));
      }
      level = next;
    }

    const root = level[0];
    expect(root).to.be.a("string");
    expect(root.length).to.be.greaterThan(0);

    // Store root on-chain — one SSTORE regardless of how many donations the
    // batch contains (constant gas; measured in scalability.test.js).
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
    const tx = await aidvocate.storeMerkleRoot(rootBytes);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  // TC-07: circuit compilation + proof generation. The compile/prove steps run
  // in Docker (circuits/scripts/docker-zk-pipeline.sh); this test verifies the
  // artifacts that pipeline produced. TC-08/TC-09 cover on-chain verification
  // against the MockVerifier here; the real-verifier versions run in
  // onchain-verify.test.js.

  it("TC-07: Circuit compiles and generates a valid proof", async function () {
    // Skip gracefully on machines where the ZK pipeline hasn't been run
    // (mirrors the skip behavior of the real-verifier suite).
    if (!existsSync(join(zkBuildDir, "proof.json"))) {
      this.skip();
    }

    // Compilation artifacts: R1CS constraint system, witness generator (WASM),
    // and the proving key from the trusted setup.
    expect(existsSync(join(zkBuildDir, "DonationVerifier.r1cs")), "R1CS missing").to.equal(true);
    expect(
      existsSync(join(zkBuildDir, "DonationVerifier_js", "DonationVerifier.wasm")),
      "witness WASM missing"
    ).to.equal(true);
    expect(existsSync(join(zkBuildDir, "DonationVerifier.zkey")), "proving key missing").to.equal(true);

    // Proof artifacts: a structurally valid Groth16 proof over BN254 with a
    // non-empty public signal (the Merkle root). Cryptographic validity is
    // asserted on-chain by the deployed verifier in onchain-verify.test.js.
    const proof = JSON.parse(readFileSync(join(zkBuildDir, "proof.json"), "utf8"));
    const pub = JSON.parse(readFileSync(join(zkBuildDir, "public.json"), "utf8"));
    expect(proof.protocol).to.equal("groth16");
    expect(proof.curve).to.equal("bn128");
    expect(proof.pi_a).to.have.lengthOf(3);
    expect(proof.pi_b).to.have.lengthOf(3);
    expect(proof.pi_c).to.have.lengthOf(3);
    expect(pub).to.be.an("array").with.lengthOf(1);
    expect(BigInt(pub[0])).to.be.greaterThan(0n);
  });

  it("TC-08: On-chain verification accepts valid proof (mock)", async function () {
    // Store a known root (the literal 12345 padded to bytes32).
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(12345n), 32);
    await aidvocate.storeMerkleRoot(rootBytes);
    const batchId = (await aidvocate.batchCount()) - 1n;

    // MockVerifier returns true, and pubSignals[0] (12345) matches the
    // stored root — so both of the contract's checks pass.
    const result = await aidvocate.verifyDonation.staticCall(
      [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [12345n], batchId
    );
    expect(result).to.equal(true);
  });

  it("TC-09: On-chain verification rejects mismatched root", async function () {
    // Store a root of 12345...
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(12345n), 32);
    await aidvocate.storeMerkleRoot(rootBytes);
    const batchId = (await aidvocate.batchCount()) - 1n;

    // ...but submit a proof claiming root 99999. Even though the mock
    // verifier would accept the proof itself, the contract's own
    // root-equality check must reject it.
    await expect(
      aidvocate.verifyDonation(
        [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [99999n], batchId
      )
    ).to.be.revertedWith("Public signal does not match stored root");
  });

  it("TC-10: Access control - non-owner cannot store root", async function () {
    // Same Ownable guard as in AidVocate.test.js, repeated here so the
    // TC matrix is complete in one suite.
    const rootBytes = ethers.keccak256(ethers.toUtf8Bytes("unauthorized"));
    await expect(
      aidvocate.connect(other).storeMerkleRoot(rootBytes)
    ).to.be.revertedWithCustomError(aidvocate, "OwnableUnauthorizedAccount");
  });
});
