// Core unit tests for the AidVocate contract.
//
// These tests use a MockVerifier (always returns true) instead of the real
// Groth16 verifier, so they exercise ONLY the contract's own logic:
// root storage, access control, and batch bookkeeping. Real ZK proof
// verification is covered separately in onchain-verify.test.js.
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AidVocate", function () {
  let aidvocate, mockVerifier, owner, other;

  // Fresh deployment before EVERY test (beforeEach, not before) so tests
  // are fully isolated — batchCount starts at 0 each time.
  beforeEach(async function () {
    // `owner` deploys the contracts and therefore owns AidVocate (Ownable);
    // `other` is an unprivileged account used to test access control.
    [owner, other] = await ethers.getSigners();
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    mockVerifier = await MockVerifier.deploy();
    // AidVocate takes the verifier address as a constructor arg, which is
    // what lets us swap the real Groth16 verifier for a mock here.
    const AidVocate = await ethers.getContractFactory("AidVocate");
    aidvocate = await AidVocate.deploy(await mockVerifier.getAddress());
  });

  describe("Merkle Root Storage", function () {
    it("TC-02: should store a Merkle root on-chain", async function () {
      // Any 32-byte value works as a root here; keccak256 of a label is just
      // a convenient way to get a unique bytes32.
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await aidvocate.storeMerkleRoot(root);
      // First stored root lands at batchId 0 — round-trip it back out.
      expect(await aidvocate.getMerkleRoot(0)).to.equal(root);
    });

    it("TC-02: should emit MerkleRootStored event", async function () {
      // Off-chain services (e.g. the donor dashboard) rely on this event to
      // discover new batches, so its emission is part of the contract API.
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await expect(aidvocate.storeMerkleRoot(root))
        .to.emit(aidvocate, "MerkleRootStored");
    });

    it("TC-10: should reject non-owner storing root", async function () {
      // Only the contract owner (the deploying backend) may publish roots;
      // OpenZeppelin Ownable reverts with this custom error for anyone else.
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await expect(
        aidvocate.connect(other).storeMerkleRoot(root)
      ).to.be.revertedWithCustomError(aidvocate, "OwnableUnauthorizedAccount");
    });

    it("should increment batchCount", async function () {
      // Each stored root gets the next sequential batchId, and earlier
      // roots remain retrievable — storage is append-only, not overwrite.
      const root1 = ethers.keccak256(ethers.toUtf8Bytes("root-1"));
      const root2 = ethers.keccak256(ethers.toUtf8Bytes("root-2"));
      await aidvocate.storeMerkleRoot(root1);
      await aidvocate.storeMerkleRoot(root2);
      expect(await aidvocate.batchCount()).to.equal(2);
      expect(await aidvocate.getMerkleRoot(0)).to.equal(root1);
      expect(await aidvocate.getMerkleRoot(1)).to.equal(root2);
    });
  });

  describe("Donation Verification", function () {
    it("should reject verification for non-existent batch", async function () {
      // The proof values are all zeros — irrelevant here, because the
      // batch-existence check happens BEFORE the verifier is ever called.
      // (pA/pB/pC mirror the Groth16 proof points; pubSignals[0] is the root.)
      const dummyProof = {
        pA: [0n, 0n],
        pB: [[0n, 0n], [0n, 0n]],
        pC: [0n, 0n],
        pubSignals: [0n]
      };
      await expect(
        aidvocate.verifyDonation(
          dummyProof.pA, dummyProof.pB, dummyProof.pC, dummyProof.pubSignals, 999
        )
      ).to.be.revertedWith("Batch does not exist");
    });
  });
});
