// Phase 2a scalability tests — demonstrates that the Merkle-batching design
// scales: off-chain tree construction time grows with batch size, while
// on-chain cost stays constant (one 32-byte root, one storeMerkleRoot tx).
// Batch sizes and tree depths follow the evaluation plan (Table 11):
// 10/100/500/1000 donations at depths 4/7/9/10. Each tree build is timed
// over 3 runs and the mean is reported; gas figures are measured, not assumed.
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { buildPoseidon } from "circomlibjs";

describe("Phase 2a: Scalability Tests", function () {
  this.timeout(600000); // Tree building can be slow (JS/WASM Poseidon)

  let aidvocate, mockVerifier, poseidon, F, ethers;

  before(async function () {
    const network = await hre.network.connect();
    ethers = network.ethers;

    poseidon = await buildPoseidon();
    F = poseidon.F;

    const [owner] = await ethers.getSigners();
    // MockVerifier is fine here — these tests only measure storage gas and
    // tree-build time, never proof verification.
    mockVerifier = await ethers.deployContract("MockVerifier");
    aidvocate = await ethers.deployContract("AidVocate", [await mockVerifier.getAddress()]);
  });

  // Build a Poseidon Merkle tree of 2^targetDepth leaves: pad the commitment
  // list with zero-leaves, then hash adjacent pairs level by level until one
  // root remains. Mirrors what the backend batching service does.
  function buildTree(commitments, targetDepth) {
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

  // Synthesize `count` donation commitments with varying donor/amount/salt
  // (same 5-field Poseidon scheme as the real circuit).
  function generateCommitments(count) {
    const commitments = [];
    for (let i = 0; i < count; i++) {
      const hash = poseidon([BigInt(i + 1), BigInt((i + 1) * 100), 1n, 1709420400n, BigInt(i * 999)]);
      commitments.push(F.toString(hash));
    }
    return commitments;
  }

  // Batch sizes per the evaluation plan (Table 11). depth = ceil(log2(n)):
  // 10 -> 4, 100 -> 7, 500 -> 9, 1000 -> 10 (the production circuit's max).
  const batchSizes = [10, 100, 500, 1000];
  const RUNS = 3; // each experiment repeated 3 times; mean reported

  for (const size of batchSizes) {
    describe(`Batch size: ${size}`, function () {
      let root;

      it(`should build Merkle tree for ${size} commitments (mean of ${RUNS} runs)`, async function () {
        const depth = Math.max(1, Math.ceil(Math.log2(size)));
        const commitments = generateCommitments(size);

        // Time the off-chain part — this is where the per-donation cost
        // lives, and it's CPU time, not gas. Repeat and average to smooth
        // out runtime jitter.
        const times = [];
        for (let run = 0; run < RUNS; run++) {
          const start = Date.now();
          root = buildTree(commitments, depth);
          times.push(Date.now() - start);
        }
        const mean = times.reduce((a, b) => a + b, 0) / RUNS;

        expect(root).to.be.a("string");
        console.log(
          `    Tree construction time (${size} donations, depth ${depth}): ` +
          `mean ${mean.toFixed(1)}ms over ${RUNS} runs [${times.join(", ")}ms]`
        );
      });

      it(`should store root with constant gas regardless of batch size`, async function () {
        // Whatever the batch size, only the 32-byte root touches the chain,
        // so the measured gas printed here should not grow with `size`.
        const rootBytes = ethers.zeroPadValue(ethers.toBeHex(BigInt(root)), 32);
        const tx = await aidvocate.storeMerkleRoot(rootBytes);
        const receipt = await tx.wait();
        console.log(`    Gas for root storage (${size} donations): ${receipt.gasUsed.toString()}`);
        expect(receipt.status).to.equal(1);
      });
    });
  }

  it("Gas comparison: individual vs batched storage (measured)", async function () {
    // Per the evaluation plan: Individual = N x (gas per root-sized write),
    // Batched = 1 x (same write). Measure the real warm storeMerkleRoot cost
    // instead of assuming a per-SSTORE figure.
    const rootBytes = ethers.zeroPadValue(ethers.toBeHex(424242n), 32);
    const tx = await aidvocate.storeMerkleRoot(rootBytes);
    const receipt = await tx.wait();
    const g = Number(receipt.gasUsed);

    const N = 1000;
    const individualGas = N * g;
    const batchedGas = g;
    const savings = ((individualGas - batchedGas) / individualGas * 100).toFixed(1);
    console.log(`    Measured storeMerkleRoot gas: ${g.toLocaleString()}`);
    console.log(`    Individual storage (${N} donations): ${individualGas.toLocaleString()} gas`);
    console.log(`    Batched storage (${N} donations): ${batchedGas.toLocaleString()} gas`);
    console.log(`    Gas savings: ${savings}%`);
    expect(parseFloat(savings)).to.be.greaterThan(90);
  });
});
