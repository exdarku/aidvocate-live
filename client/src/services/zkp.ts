import type { MerkleProof, Donation } from './api';

// snarkjs is published as a UMD module without proper types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const snarkjs: any = await import('snarkjs');

const THESIS_API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ZkProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface GeneratedProof {
  proof: ZkProof;
  publicSignals: string[];
}

export async function generateDonationProof(
  donation: Donation,
  merkleProof: MerkleProof
): Promise<GeneratedProof> {
  const wasmUrl = `${THESIS_API_URL}/verify/artifacts/wasm`;
  const zkeyUrl = `${THESIS_API_URL}/verify/artifacts/zkey`;

  const input = {
    donorId: String(donation.donorId),
    amount: String(Math.round(donation.amount * 100)),
    ngoId: String(donation.ngoId),
    timestamp: String(donation.timestamp),
    salt: donation.salt,
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices,
    root: merkleProof.root,
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmUrl, zkeyUrl);
  return { proof, publicSignals };
}
