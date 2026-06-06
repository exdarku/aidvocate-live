// Generate witness inputs for the ZoKrates and Noir ports from the canonical
// build/input.json (produced by gen-input.js). Both ports RETURN the computed
// Merkle root as a public output (instead of asserting against a public
// input), so only the 25 private inputs are needed here. The returned root is
// cross-checked against input.json's merkleRoot after each pipeline run when
// the toolchain's Poseidon is circomlib-compatible.
//
// Run from anywhere: node circuits/scripts/gen-toolchain-inputs.js
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const circuitsDir = join(__dirname, "..");
const input = JSON.parse(readFileSync(join(circuitsDir, "build", "input.json"), "utf8"));

const fields = [input.donorId, input.amount, input.ngoId, input.timestamp, input.salt];

// --- ZoKrates: space-separated decimal args in declaration order ---
const zokArgs = [
  ...fields,
  ...input.pathElements.map(String),
  ...input.pathIndices.map(String),
].join(" ");
mkdirSync(join(circuitsDir, "zokrates"), { recursive: true });
writeFileSync(join(circuitsDir, "zokrates", "args.txt"), zokArgs + "\n");
console.log("wrote zokrates/args.txt (25 values)");

// --- Noir: Prover.toml ---
const toml = [
  `donor_id = "${input.donorId}"`,
  `amount = "${input.amount}"`,
  `ngo_id = "${input.ngoId}"`,
  `timestamp = "${input.timestamp}"`,
  `salt = "${input.salt}"`,
  `path_elements = [${input.pathElements.map((v) => `"${v}"`).join(", ")}]`,
  `path_indices = [${input.pathIndices.map((v) => `"${v}"`).join(", ")}]`,
  "",
].join("\n");
mkdirSync(join(circuitsDir, "noir"), { recursive: true });
writeFileSync(join(circuitsDir, "noir", "Prover.toml"), toml);
console.log("wrote noir/Prover.toml");
console.log("expected merkleRoot =", input.merkleRoot);
