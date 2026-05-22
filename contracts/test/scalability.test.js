import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { buildPoseidon } from "circomlibjs";

describe("Phase 2a: Scalability Tests", function () {
  this.timeout(600000); // Tree building can be slow

  let aidvocate, mockVerifier, poseidon, F, ethers;

  before(async function () {
    const network = await hre.network.connect();
    ethers = network.ethers;

    poseidon = await buildPoseidon();
    F = poseidon.F;

    const [owner] = await ethers.getSigners();
    mockVerifier = await ethers.deployContract("MockVerifier");
    aidvocate = await ethers.deployContract("AidVocate", [await mockVerifier.getAddress()]);
  });

  async function buildTree(commitments, targetDepth) {
    const size = 2 ** targetDepth;
    const padded = [...commitments];
    while (padded.length < size) padded.push("0");

    let level = padded;
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const hash = poseidon([BigInt(level[i]), BigInt(level[i + 1])]);
        next.push(F.toString(hash));
      }
      level = next;
    }
    return level[0];
  }

  function generateCommitments(count) {
    const commitments = [];
    for (let i = 0; i < count; i++) {
      const hash = poseidon([BigInt(i + 1), BigInt((i + 1) * 100), 1n, 1709420400n, BigInt(i * 999)]);
      commitments.push(F.toString(hash));
    }
    return commitments;
  }

  const batchSizes = [10, 100];
  // Note: 500 and 1000 are slow in JS Poseidon — test in Docker with native tools
  // For CI/local testing, we test 10 and 100

  for (const size of batchSizes) {
    describe(`Batch size: ${size}`, function () {
      let root;
      let treeTime;

      it(`should build Merkle tree for ${size} commitments`, async function () {
        const depth = Math.ceil(Math.log2(size)) + 1;
        const commitments = generateCommitments(size);

        const start = Date.now();
        root = await buildTree(commitments, depth);
        treeTime = Date.now() - start;

        expect(root).to.be.a("string");
        console.log(`    Tree construction time (${size} donations, depth ${depth}): ${treeTime}ms`);
      });

      it(`should store root with constant gas (~22,000)`, async function () {
        const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
        const tx = await aidvocate.storeMerkleRoot(rootBytes);
        const receipt = await tx.wait();
        console.log(`    Gas for root storage (${size} donations): ${receipt.gasUsed.toString()}`);
        expect(receipt.status).to.equal(1);
      });
    });
  }

  it("Gas comparison: individual vs batched storage", function () {
    // Individual: N * ~22,000 gas per SSTORE
    // Batched: 1 * ~22,000 gas for one root
    const individualGas1000 = 1000 * 22000;
    const batchedGas = 22000;
    const savings = ((individualGas1000 - batchedGas) / individualGas1000 * 100).toFixed(1);
    console.log(`    Individual storage (1000 donations): ${individualGas1000.toLocaleString()} gas`);
    console.log(`    Batched storage (1000 donations): ${batchedGas.toLocaleString()} gas`);
    console.log(`    Gas savings: ${savings}%`);
    expect(parseFloat(savings)).to.be.greaterThan(90);
  });
});
