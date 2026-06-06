// Generate a valid proof input (build/input.json) for DonationVerifier (depth 10).
// Places the donation commitment at leaf index 0 of an otherwise-empty tree and
// derives the Merkle path + root using the SAME Poseidon(2) the circuit uses.
// Run from circuits/ with circomlibjs resolvable (we point NODE_PATH at contracts).
import pkg from "/Users/laurence/Documents/School/AWS/Capstone/AidVocate/contracts/node_modules/circomlibjs/build/main.cjs";
const { buildPoseidon } = pkg;
import { writeFileSync, mkdirSync } from "fs";

const poseidon = await buildPoseidon();
const F = poseidon.F;
const DEPTH = 10;

const donation = {
  donorId: 12345n,
  amount: 100000n,
  ngoId: 1n,
  timestamp: 1709420400n,
  salt: 98765432101234567890n,
};

// commitment = Poseidon(5)
const commitment = F.toString(
  poseidon([donation.donorId, donation.amount, donation.ngoId, donation.timestamp, donation.salt])
);

// Leaf index 0 => every step is a left node, sibling = the all-zero subtree hash.
const zero = ["0"];
for (let i = 1; i <= DEPTH; i++) {
  zero[i] = F.toString(poseidon([BigInt(zero[i - 1]), BigInt(zero[i - 1])]));
}

const pathElements = [];
const pathIndices = [];
let cur = BigInt(commitment);
for (let i = 0; i < DEPTH; i++) {
  pathElements.push(zero[i]);
  pathIndices.push(0);
  cur = BigInt(F.toString(poseidon([cur, BigInt(zero[i])])));
}
const merkleRoot = cur.toString();

const input = {
  donorId: donation.donorId.toString(),
  amount: donation.amount.toString(),
  ngoId: donation.ngoId.toString(),
  timestamp: donation.timestamp.toString(),
  salt: donation.salt.toString(),
  pathElements,
  pathIndices,
  merkleRoot,
};

const outDir = "/Users/laurence/Documents/School/AWS/Capstone/AidVocate/circuits/build";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/input.json`, JSON.stringify(input, null, 2));
console.log("commitment =", commitment);
console.log("merkleRoot =", merkleRoot);
console.log("wrote build/input.json");
