# Paper Alignment: Tests + Cross-Toolchain Benchmark — Design

**Date:** 2026-06-06
**Status:** Approved (build + run)
**Goal:** Make the repository back up the thesis paper's testing claims ("LIVEST FILE OF THEM ALL.pdf"). Where the paper describes methodology the repo doesn't implement, implement it; where the repo carries stale numbers the paper has corrected (Tables 19/24), update the repo.

## Background

An audit of the paper against the repo found test-suite mismatches (batch sizes, depth formula, repetition counts, placeholder TC-07, hardcoded ~22k gas, phase labels) and an entire benchmark (Table 18: Circom+PLONK, ZoKrates+Groth16, Noir+UltraHonk) that exists only as a design spec (`2026-06-04-zk-toolchain-benchmark-design.md`, approved, unimplemented). Out of scope for this work: the paper-side errors (§4.3 wrong API names, OpenZeppelin MerkleProof claim, Amoy deployment claim, duplicated tables) — those are document edits, not code.

## Changes

### 1. `contracts/test/scalability.test.js` — match Table 11 + §3.5.3

- Batch sizes `[10, 100, 500, 1000]` with depth `max(1, ceil(log2 n))` → 4/7/9/10 (drop the current `+1`).
- Tree construction timed over **3 runs**, mean reported (paper: "executed a minimum of three times… mean values were used").
- Root-storage gas printed as measured; no 22k label.

### 2. Gas figures — match Tables 19/24

- Remove all "~22,000" labels/comments in tests.
- Savings test measures warm `storeMerkleRoot` gas in-test and applies §3.6.2's formula (Individual = N×g, Batched = g); assertion stays `> 90%`.

### 3. TC-07 — match Table 10

- Replace placeholder with artifact checks: `DonationVerifier.r1cs`, witness wasm, `.zkey` exist; `proof.json` is structurally a Groth16/bn128 proof; `public.json` non-empty. Skips when the ZK pipeline hasn't run (same pattern as the on-chain suite). Cryptographic validity is asserted on-chain by the real-verifier test.

### 4. Phase labels

- `onchain-verify.test.js`: "Phase 2b" → "Phase 2a" (paper: 2a = performance, 2b = security, 2c = usability).

### 5. New `circuits/scripts/docker-plonk-pipeline.sh` — back Table 18 row 4 (Circom + PLONK)

- Same circuit/r1cs; `snarkjs plonk setup` (universal, no contribution) → prove → verify; 5 timed runs per stage; artifact sizes.
- Powers-of-tau: try `pot14`; if snarkjs reports the ptau is too small for PLONK's row count, download `pot16` and retry (documented in the script header).
- Export `PlonkVerifierFresh.sol` via `snarkjs zkey export solidityverifier`; new skip-if-absent Hardhat test `contracts/test/plonk-verify.test.js` deploys it and measures verification gas (backs the paper's 290,222 figure).

### 6. Implement the approved ZoKrates/Noir spec — back Table 18 rows 2–3

Per `2026-06-04-zk-toolchain-benchmark-design.md` (approach A):

- `circuits/zokrates/DonationVerifier.zok` + `scripts/docker-zokrates-pipeline.sh` (`zokrates/zokrates` image; compile → setup (Groth16/BN254) → compute-witness → generate-proof → verify; 5 timed runs).
- `circuits/noir/` (Nargo.toml, `src/main.nr`, `Prover.toml`) + `scripts/docker-noir-pipeline.sh` (pinned nargo + bb; compile → execute → prove (UltraHonk) → verify; 5 timed runs). No trusted-setup stage — reported as "n/a (UltraHonk)".
- Verify gas for ZoKrates/Noir stays unmeasured, matching the paper's "not measured".
- Poseidon stdlib differences across toolchains are expected and documented; constraint counts/roots will not be bit-identical.

## Execution

After building, run everything: the Hardhat suite, `benchmark-merkle.js`, and the three Docker pipelines (linux/amd64, QEMU-emulated where needed). Report measured numbers next to the paper's Table 18 values; where they differ (different machine/day), flag the rows the paper should refresh. Fail loudly — no fabricated numbers; if a pipeline cannot complete (image pull failure, stdlib gap), report that honestly.

## Testing / verification gates

- All Hardhat tests pass after the changes.
- Each pipeline ends with its own verifier accepting the proof; tamper-check fails verification.
- PLONK on-chain test: deployed PlonkVerifier returns true for the real proof.
