import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AidVocate", function () {
  let aidvocate, mockVerifier, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    mockVerifier = await MockVerifier.deploy();
    const AidVocate = await ethers.getContractFactory("AidVocate");
    aidvocate = await AidVocate.deploy(await mockVerifier.getAddress());
  });

  describe("Merkle Root Storage", function () {
    it("TC-02: should store a Merkle root on-chain", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await aidvocate.storeMerkleRoot(root);
      expect(await aidvocate.getMerkleRoot(0)).to.equal(root);
    });

    it("TC-02: should emit MerkleRootStored event", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await expect(aidvocate.storeMerkleRoot(root))
        .to.emit(aidvocate, "MerkleRootStored");
    });

    it("TC-10: should reject non-owner storing root", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await expect(
        aidvocate.connect(other).storeMerkleRoot(root)
      ).to.be.revertedWithCustomError(aidvocate, "OwnableUnauthorizedAccount");
    });

    it("should increment batchCount", async function () {
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
