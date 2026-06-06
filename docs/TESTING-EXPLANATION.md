# AidVocate — Testing Explanation

This document explains every automated test and benchmark script in the repository: what it does, why it exists, what it measures, and which part of the evaluation it supports. It is written to be lifted into the thesis (methods/appendix) so that every number in the paper can be traced to a specific, runnable artifact.

**Test suite at a glance:** `npx hardhat test` runs **33 tests across 7 files**, all passing. Four of those files deploy a *real* zero-knowledge verifier on-chain (one per proving-system combination); the rest exercise the contract logic and scalability properties.

---

## 1. Smart-contract test suites (`contracts/test/`)

### 1.1 `AidVocate.test.js` — core unit tests (5 tests)

Unit tests for the `AidVocate` contract in isolation. A **MockVerifier** (a stub that always returns `true`) stands in for the Groth16 verifier so that these tests exercise *only the contract's own logic*, independent of any cryptography:

| Test | What it proves |
|---|---|
| TC-02: store a Merkle root | A 32-byte root is written on-chain and can be read back by batch ID |
| TC-02: emit `MerkleRootStored` | The event off-chain services rely on is part of the contract API |
| TC-10: reject non-owner | Only the contract owner can publish roots (OpenZeppelin `Ownable`) |
| batchCount increments | Roots are append-only: each store gets a fresh, sequential batch ID and earlier roots remain retrievable |
| reject non-existent batch | `verifyDonation` reverts with `"Batch does not exist"` *before* the verifier is ever consulted |

Each test deploys fresh contracts (`beforeEach`), so they are fully independent.

### 1.2 `integration.test.js` — functional test matrix TC-01…TC-10 (10 tests)

The complete functional test-case matrix from the evaluation plan, run against one shared deployment. Real **Poseidon hashing** (via `circomlibjs`, the same hash the circuit uses) is combined with the MockVerifier, so commitment and Merkle logic are genuine while proof acceptance is stubbed:

| Test | What it does |
|---|---|
| TC-01 | Computes `commitment = Poseidon(donorId, amount, ngoId, timestamp, salt)` twice and asserts determinism — the donor must be able to re-derive the identical commitment later |
| TC-02 | Stores a root on-chain and reads it back |
| TC-03 | Builds a minimal Merkle tree around a real commitment, stores the root, and confirms `verifyDonation` succeeds when the public signal matches the stored root |
| TC-04 | Verification against a non-existent batch **reverts** |
| TC-05 | Tampering with the donation amount changes the Poseidon commitment entirely — tamper-evidence of the commitment scheme |
| TC-06 | Batches 10 commitments into a depth-4 Merkle tree (padded to 16 leaves) built bottom-up, and stores only the single root on-chain |
| TC-07 | Asserts the ZK pipeline artifacts exist and are well-formed: the compiled R1CS, the witness-generator WASM, the proving key, and a structurally valid Groth16/BN254 proof with a non-empty public signal. (Compilation/proving itself runs in Docker; cryptographic validity is asserted on-chain in §1.4.) Skips on machines where the pipeline has not been run |
| TC-08 | With the public signal matching the stored root, verification passes |
| TC-09 | With a **wrong** public signal, the contract's own root-equality check reverts with `"Public signal does not match stored root"` — even though the mock verifier would have accepted the proof |
| TC-10 | A non-owner attempting `storeMerkleRoot` reverts with `OwnableUnauthorizedAccount` |

### 1.3 `scalability.test.js` — Phase 2a scalability (9 tests)

Demonstrates the central scalability claim: **off-chain work grows with batch size; on-chain cost does not.** Batch sizes and tree depths follow the evaluation plan (Table 11): **10 / 100 / 500 / 1,000 donations at depths 4 / 7 / 9 / 10** (depth = ⌈log₂ n⌉; depth 10 is the production circuit's maximum, 1,024 leaves).

For each batch size:
1. **Tree construction** — synthesizes n donation commitments (same 5-field Poseidon scheme as the circuit) and builds the full Merkle tree, timed over **3 runs with the mean reported** (per the methodology's repeat-and-average requirement).
2. **Root storage** — stores the resulting root and prints the **measured** transaction gas, demonstrating it is identical (53,097) regardless of whether the batch held 10 or 1,000 donations.

A final test measures `storeMerkleRoot` gas live and computes the batching savings from measured data: individual storage of 1,000 donations would cost 1,000 × the measured write, batching costs 1 ×, i.e. **99.9% savings** — asserted to exceed 90%.

### 1.4 `onchain-verify.test.js` — real Groth16 verification (3 tests)

The first of the four *real-cryptography* suites. It loads the Groth16 proof produced by the Docker pipeline (`circuits/build/proof.json` + `public.json`), deploys the **actual snarkjs-generated verifier contract** (`Groth16VerifierFresh.sol`), wires it into `AidVocate`, and:

1. Stores the batch root the proof was generated against, reporting gas (**70,197** first write).
2. Submits the real proof: a static call confirms `verifyDonation` returns `true`, then a transaction measures the full cost — **218,720 gas**, dominated by the EVM's elliptic-curve pairing precompiles.
3. Stores a *different* root and submits the same proof against it: the public signal no longer matches and the transaction **reverts** — a proof cannot be redirected to a batch it does not belong to.

A note on encoding: snarkjs outputs G2 points as `[x₀,x₁]` while the Solidity verifier expects `[x₁,x₀]`; the test performs this standard coordinate swap when building calldata.

### 1.5 `plonk-verify.test.js` — real PLONK verification (2 tests)

Deploys the **PLONK** verifier exported by `docker-plonk-pipeline.sh` (`PlonkVerifierFresh.sol`) and verifies the same donation statement under the PLONK proving system: the real proof (24 field elements: 9 curve points + 6 evaluations) is accepted (**293,366 gas**), and a flipped public signal is rejected. This isolates the *proving-system* cost difference from the contract wrapper, completing the Groth16-vs-PLONK comparison with measured on-chain numbers.

### 1.6 `zokrates-verify.test.js` — real ZoKrates/Groth16 verification (2 tests)

Deploys the verifier exported by `zokrates export-verifier` (`ZoKratesVerifierFresh.sol`) and submits the proof generated by the ZoKrates pipeline: accepted at **234,529 gas**; a flipped public input returns `false`. This fills in the verification-gas figure the original benchmark left unmeasured for ZoKrates.

### 1.7 `honk-verify.test.js` — real UltraHonk (Noir) verification (2 tests)

Deploys the Barretenberg-exported UltraHonk verifier (`HonkVerifierFresh.sol`, compiled with solc 0.8.28 as the generated code requires) and verifies the Noir proof on-chain: accepted at **2,385,342 gas** (~10.9× Groth16 — a structural property of Honk proofs, which trade verifier cost for prover speed and no trusted setup); a flipped public input is rejected. Note: the EVM verifier only accepts **keccak-transcript** proofs (`bb prove --oracle_hash keccak`); the Noir pipeline produces these in a dedicated stage.

---

## 2. Benchmark pipelines (`circuits/scripts/`)

All pipelines run in Docker for reproducibility, follow the same structure (numbered stages, `set -e` loud failure — a stage that cannot run aborts instead of producing fake numbers), and time each cryptographic stage over **5 runs**.

### 2.1 `docker-zk-pipeline.sh` — Circom + Groth16 (production stack)

The full production pipeline: compile `DonationVerifier.circom` → Groth16 trusted setup (Phase 1 from the public Hermez Powers-of-Tau file `pot14.ptau`; Phase 2 contribution locally) → witness generation → proof generation → CLI verification, each timed. Outputs the artifacts every real-verifier test consumes (`proof.json`, `public.json`, `verification_key.json`, the `.zkey`). Source of the §3.2 timings (witness ~395 ms, prove ~3.6 s emulated).

### 2.2 `docker-plonk-pipeline.sh` — Circom + PLONK

Same compiled circuit, PLONK proving system: **universal setup** (no per-circuit contribution — PLONK consumes the Powers-of-Tau directly), prove, verify, each timed 5×. Because PLONK's row count for this circuit is **32,063** (vs 2,751 R1CS), the 2^14 ceremony file is too small and the script automatically falls back to `pot16.ptau` (2^16). Also exports the Solidity verifier and calldata used by `plonk-verify.test.js`.

### 2.3 `docker-zokrates-pipeline.sh` — ZoKrates + Groth16

Runs the ZoKrates port (`circuits/zokrates/DonationVerifier.zok`) through compile → setup → compute-witness → generate-proof → verify (5 timed runs each), reporting the constraint count (2,752 — within 1 of the Circom circuit) and exporting the Solidity verifier for `zokrates-verify.test.js`. ZoKrates' stdlib Poseidon is circomlib-compatible: the port computes the **identical Merkle root** to the Circom circuit.

### 2.4 `docker-noir-pipeline.sh` — Noir + UltraHonk

Installs the pinned toolchain (nargo 1.0.0-beta.6, Barretenberg bb 0.84.0 — the versions in the benchmark environment table), then compiles the Noir port (`circuits/noir/src/main.nr`), executes the witness, proves with **UltraHonk** (no trusted-setup stage — reported as n/a), and verifies, 5 timed runs each. A dedicated stage re-proves with the **keccak transcript** and exports the EVM verifier for `honk-verify.test.js`. Runs natively on arm64 (matching the benchmark environment's aarch64 kernel). The Noir Poseidon is also circomlib-compatible (identical root).

**Port design note (both ZoKrates and Noir):** the ports *return* the computed Merkle root as a public output instead of asserting equality with a public input. The binding is semantically identical — the verifier sees the root either way — and it makes input preparation robust across toolchains.

---

## 3. Supporting scripts

### 3.1 `circuits/scripts/gen-input.js`

Generates a valid witness (`circuits/build/input.json`) for the depth-10 circuit: a sample donation's commitment placed at leaf 0 of an otherwise-empty tree, with the Merkle path and root derived using the same Poseidon the circuit uses. Every pipeline proves against this input, which is what makes the cross-toolchain root-identity check possible.

### 3.2 `circuits/scripts/gen-toolchain-inputs.js`

Translates `input.json` into each toolchain's input format: a space-separated argument list for `zokrates compute-witness` and a `Prover.toml` for `nargo execute`.

### 3.3 `contracts/scripts/benchmark-merkle.js`

Off-chain Merkle scalability benchmark (source of the construction-time table): for batch sizes 10/50/100/250/500/1,000 it times commitment generation (Poseidon-5) and tree construction (Poseidon-2) separately, confirming linear scaling (~150 ms for a full 1,024-leaf batch in single-threaded JavaScript) and that commitment hashing dominates.

### 3.4 `contracts/scripts/weight-sensitivity.js`

Stress-tests the multi-criteria rankings against the choice of weights, answering "would a different weighting change the conclusions?" Four analyses per ranking:

1. **Baseline** — reproduces the published composite scores under the documented methodology (min-max normalization, weighted sum, weight renormalization when a metric is unmeasured).
2. **Exhaustive sweep** — evaluates *all 969 weight combinations* on a 0.05 grid and reports how often each candidate ranks first.
3. **Perturbation** — shifts each weight ±0.10 (others rescaled) and checks whether the winner changes.
4. **Flip thresholds** — finds the minimum weight a single criterion must carry before the winner changes.

Headline results: **Poseidon** ranks first in 86.1% of all possible weightings and only loses when security maturity alone carries ≥0.60 of total weight (a weighting incompatible with the client-side-proving requirement); a **Groth16** framework ranks first in **100%** of weightings for the proving-system selection.

### 3.5 `circuits/scripts/security-analysis.sh`

Runs Circomspect (Trail of Bits' static analyzer for Circom) against `DonationVerifier.circom` and saves the report — the automated half of the circuit security review (result: no issues; the manual half checks binary-constrained path indices, the fully-constrained conditional swap, and root binding).

---

## 4. Traceability: tests → evaluation claims

| Evaluation claim | Evidence |
|---|---|
| Functional correctness (TC-01…TC-10) | `AidVocate.test.js`, `integration.test.js` |
| Real proof verified on-chain; tampering rejected | `onchain-verify.test.js` |
| Root-storage gas constant per batch (O(1)) | `scalability.test.js` |
| Tree construction linear, ~150 ms at 1,024 leaves | `scalability.test.js`, `benchmark-merkle.js` |
| Groth16 218,720 / PLONK 293,366 / ZoKrates 234,529 / UltraHonk 2,385,342 verify gas | the four `*-verify.test.js` suites |
| Proof sizes 807 B / 2,245 B / 849 B / 14,080 B | the four Docker pipelines |
| Selection conclusions robust to weighting | `weight-sensitivity.js` |
| Circuit soundly constrained | `security-analysis.sh` + manual review |
