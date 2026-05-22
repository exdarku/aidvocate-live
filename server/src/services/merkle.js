import { buildPoseidon } from "circomlibjs";

let poseidon;
let F;

async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
    F = poseidon.F;
  }
}

export async function computeCommitment(donorId, amount, ngoId, timestamp, salt) {
  await initPoseidon();
  const hash = poseidon([
    BigInt(donorId),
    BigInt(Math.round(amount * 100)),
    BigInt(ngoId),
    BigInt(timestamp),
    BigInt(salt)
  ]);
  return F.toString(hash);
}

export async function poseidonHash2(left, right) {
  await initPoseidon();
  const hash = poseidon([BigInt(left), BigInt(right)]);
  return F.toString(hash);
}

export async function buildMerkleTree(commitments) {
  await initPoseidon();

  const depth = 10;
  const size = 2 ** depth;
  const paddedCommitments = [...commitments];
  while (paddedCommitments.length < size) {
    paddedCommitments.push("0");
  }

  let currentLevel = paddedCommitments;
  const layers = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const hash = await poseidonHash2(currentLevel[i], currentLevel[i + 1]);
      nextLevel.push(hash);
    }
    currentLevel = nextLevel;
    layers.push(currentLevel);
  }

  const root = currentLevel[0];
  return { root, layers };
}

export async function getMerkleProof(batchId, commitment) {
  // Dynamic import to avoid circular dependency
  const { default: db } = await import("../db.js");
  const batch = db.prepare("SELECT * FROM batches WHERE id = ?").get(batchId);
  if (!batch) return null;

  const commitments = JSON.parse(batch.commitments);
  const { layers } = await buildMerkleTree(commitments);

  const depth = 10;
  const size = 2 ** depth;
  const paddedCommitments = [...commitments];
  while (paddedCommitments.length < size) {
    paddedCommitments.push("0");
  }

  const leafIndex = paddedCommitments.indexOf(commitment);
  if (leafIndex === -1) return null;

  const pathElements = [];
  const pathIndices = [];

  let idx = leafIndex;
  for (let i = 0; i < depth; i++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    pathElements.push(layers[i][siblingIdx]);
    pathIndices.push(idx % 2 === 0 ? 0 : 1);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices, root: batch.merkleRoot };
}
