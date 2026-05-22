import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
// Fallback is the well-known Hardhat account #0 test key — NOT a production secret
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

let contract;

function getContract() {
  if (contract) return contract;

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const abi = [
    "function storeMerkleRoot(bytes32 root) external returns (uint256)",
    "function getMerkleRoot(uint256 batchId) external view returns (bytes32)",
    "function verifyDonation(uint256[2] _pA, uint256[2][2] _pB, uint256[2] _pC, uint256[1] _pubSignals, uint256 _batchId) external returns (bool)",
    "function batchCount() external view returns (uint256)",
    "event MerkleRootStored(uint256 indexed batchId, bytes32 root, uint256 timestamp)",
    "event DonationVerified(uint256 indexed batchId, bool valid, uint256 timestamp)"
  ];

  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
  return contract;
}

export async function submitMerkleRoot(merkleRoot) {
  const c = getContract();
  const rootBigInt = BigInt(merkleRoot);
  const rootBytes32 = ethers.zeroPadValue(ethers.toBeHex(rootBigInt), 32);

  const tx = await c.storeMerkleRoot(rootBytes32);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function verifyProofOnChain(proof, publicSignals, batchId) {
  const c = getContract();
  const result = await c.verifyDonation(
    proof.pi_a.slice(0, 2),
    [proof.pi_b[0].reverse(), proof.pi_b[1].reverse()],
    proof.pi_c.slice(0, 2),
    publicSignals,
    batchId
  );
  return result;
}

export { getContract };
