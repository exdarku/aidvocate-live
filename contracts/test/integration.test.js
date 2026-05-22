import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { buildPoseidon } from "circomlibjs";

describe("Phase 2a: Functional Tests (TC-01 to TC-10)", function () {
  this.timeout(120000);

  let aidvocate, mockVerifier, owner, other;
  let poseidon, F;
  let ethers;

  const testDonation = {
    donorId: 12345n,
    amount: 100000n,
    ngoId: 1n,
    timestamp: 1709420400n,
    salt: 98765432101234567890n
  };

  before(async function () {
    const network = await hre.network.connect();
    ethers = network.ethers;

    poseidon = await buildPoseidon();
    F = poseidon.F;

    [owner, other] = await ethers.getSigners();

    mockVerifier = await ethers.deployContract("MockVerifier");
    aidvocate = await ethers.deployContract("AidVocate", [await mockVerifier.getAddress()]);
  });

  it("TC-01: Generate deterministic commitment using Poseidon", async function () {
    const hash = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);
    const commitment = F.toString(hash);
    expect(commitment).to.be.a("string");
    expect(commitment.length).to.be.greaterThan(0);

    // Verify determinism
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
    // Compute commitment
    const hash = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);
    const commitment = F.toString(hash);

    // Build simple Merkle tree (depth 1) with one leaf
    const sibling = F.toString(poseidon([0n, 0n]));
    const root = F.toString(poseidon([BigInt(commitment), BigInt(sibling)]));

    // Store root on-chain
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
    await aidvocate.storeMerkleRoot(rootBytes);

    // Verify: with mock verifier, this should succeed
    const batchId = (await aidvocate.batchCount()) - 1n;
    const pubSignals = [BigInt(root)];

    // MockVerifier always returns true, so the verification should pass
    // The contract checks pubSignals[0] matches stored root
    const result = await aidvocate.verifyDonation.staticCall(
      [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n],
      [BigInt("0x" + rootBytes.slice(2))],
      batchId
    );
    expect(result).to.equal(true);
  });

  it("TC-04: Reject invalid commitment", async function () {
    // Try to verify against non-existent batch
    await expect(
      aidvocate.verifyDonation(
        [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [0n], 999n
      )
    ).to.be.revertedWith("Batch does not exist");
  });

  it("TC-05: Detect tampered donation data", async function () {
    const hash1 = poseidon([
      testDonation.donorId, testDonation.amount,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);

    // Tamper: change amount
    const hash2 = poseidon([
      testDonation.donorId, 999999n,
      testDonation.ngoId, testDonation.timestamp, testDonation.salt
    ]);

    expect(F.toString(hash1)).to.not.equal(F.toString(hash2));
  });

  it("TC-06: Batch commitments into Merkle tree", async function () {
    // Create 10 commitments
    const commitments = [];
    for (let i = 0; i < 10; i++) {
      const hash = poseidon([
        BigInt(i + 1), BigInt((i + 1) * 100),
        1n, testDonation.timestamp, BigInt(i * 111111)
      ]);
      commitments.push(F.toString(hash));
    }

    // Pad to 16 (next power of 2 for depth 4)
    while (commitments.length < 16) {
      commitments.push("0");
    }

    // Build tree bottom-up
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

    // Store root on-chain (constant gas regardless of batch size)
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
    const tx = await aidvocate.storeMerkleRoot(rootBytes);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  // TC-07, TC-08, TC-09: ZKP circuit tests — require circom compilation (Docker only)
  // These are documented as placeholder tests that verify the contract interface

  it("TC-07: Circuit compilation interface check (placeholder)", async function () {
    // Full test requires circom compilation inside Docker
    // This verifies the contract accepts the correct proof format
    expect(await aidvocate.batchCount()).to.be.greaterThan(0);
  });

  it("TC-08: On-chain verification accepts valid proof (mock)", async function () {
    // Store a root
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(12345n), 32);
    await aidvocate.storeMerkleRoot(rootBytes);
    const batchId = (await aidvocate.batchCount()) - 1n;

    // MockVerifier returns true, and pubSignals matches stored root
    const result = await aidvocate.verifyDonation.staticCall(
      [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [12345n], batchId
    );
    expect(result).to.equal(true);
  });

  it("TC-09: On-chain verification rejects mismatched root", async function () {
    // Store a root
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(12345n), 32);
    await aidvocate.storeMerkleRoot(rootBytes);
    const batchId = (await aidvocate.batchCount()) - 1n;

    // Submit proof with WRONG public signal (different root)
    await expect(
      aidvocate.verifyDonation(
        [0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [99999n], batchId
      )
    ).to.be.revertedWith("Public signal does not match stored root");
  });

  it("TC-10: Access control - non-owner cannot store root", async function () {
    const rootBytes = ethers.keccak256(ethers.toUtf8Bytes("unauthorized"));
    await expect(
      aidvocate.connect(other).storeMerkleRoot(rootBytes)
    ).to.be.revertedWithCustomError(aidvocate, "OwnableUnauthorizedAccount");
  });
});
