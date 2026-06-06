# AidVocate — Testing Explanation (Technical Walkthrough)

This document explains, at a technical level, how each test and benchmark script in the repository actually executes: what it imports and why, how it sets up its environment, and the step-by-step process it performs. No source code is reproduced; the goal is that a reader can understand precisely what runs when each artifact is invoked.

Running `npx hardhat test` from `contracts/` executes **33 tests across 7 files**. Hardhat compiles the Solidity sources (solc 0.8.20 with the optimizer at 200 runs; one generated verifier requires solc 0.8.28 via a per-file override), starts an in-process Ethereum Virtual Machine (the Hardhat Network) with pre-funded test accounts, and runs the Mocha test files against it. Nothing touches a public network; every deployment and transaction happens inside the simulated chain, which makes gas measurements deterministic and repeatable.

---

## 1. Smart-contract test suites (`contracts/test/`)

All seven suites share the same foundations:

- **Mocha** provides the test structure (`describe` blocks group related tests; `before`/`beforeEach` hooks run setup; each `it` is one test case).
- **Chai** provides the assertions (`expect(...)`), extended by Hardhat's chai matchers with blockchain-specific checks such as "this transaction must revert with this message" and "this transaction must emit this event."
- **Hardhat + ethers.js v6** provide the chain connection. Each suite first connects to the Hardhat Network and obtains an `ethers` instance bound to it; from that it gets *signers* (test accounts with private keys and ETH balances) and deploys contracts by name — Hardhat resolves the name against the compiled artifacts, sends the deployment transaction, and returns a typed contract object whose methods send transactions or make read-only calls.

Two calling conventions matter throughout: a **transaction** call actually executes on-chain, consumes gas, and returns a receipt (from which `gasUsed` and `status` are read); a **static call** simulates the same execution without mining a transaction, which is how the tests read the boolean return value of state-changing functions.

### 1.1 `AidVocate.test.js`

**Imports:** chai (assertions) and the Hardhat network module (chain connection).

**Setup (`beforeEach` — fresh state for every test):** retrieves two signers — the first becomes the contract owner by deploying, the second is a deliberately unprivileged account. It deploys `MockVerifier` (a stub whose proof-verification function always returns true), then deploys `AidVocate`, passing the mock's address to the constructor. Because `AidVocate` takes its verifier as a constructor argument, the cryptographic component can be swapped out, leaving only the contract's own storage, events, and access-control logic under test.

**Process per test:** roots are fabricated by keccak-hashing a label into a 32-byte value (any `bytes32` works for storage tests). The suite then exercises: storing a root and reading it back by batch ID; asserting the `MerkleRootStored` event fires (via the event matcher); reconnecting the contract object to the second signer and asserting `storeMerkleRoot` reverts with OpenZeppelin's `OwnableUnauthorizedAccount` custom error; storing two roots and asserting the batch counter advanced and both remain readable; and calling `verifyDonation` with all-zero proof material against a non-existent batch ID, asserting the revert message `"Batch does not exist"` — which demonstrates the existence check fires before the verifier is ever consulted.

### 1.2 `integration.test.js` (TC-01…TC-10)

**Imports:** mocha, chai, Hardhat, **circomlibjs** (a WebAssembly build of the Poseidon hash — the *same* construction the circuit uses, so commitments computed in the test are bit-identical to in-circuit ones), and Node's filesystem/path modules for TC-07's artifact checks.

**Setup (`before` — one shared deployment, because the TC sequence intentionally builds state):** connects to the network, initializes the Poseidon hasher (an async WASM instantiation, which is why the suite carries a long timeout), grabs owner/other signers, and deploys MockVerifier + AidVocate as above. A fixed sample donation (donor ID, amount, NGO ID, timestamp, salt) is declared once and reused.

**Process:**
- **TC-01** feeds the five donation fields to Poseidon twice and asserts both digests are identical — establishing the determinism a donor needs to re-derive their commitment later. Poseidon returns field elements; a field helper converts them to decimal strings for comparison.
- **TC-02** stores a root and reads it back.
- **TC-03** computes the real commitment, hand-builds the smallest possible Merkle tree (the commitment paired with one zero-leaf sibling, hashed once for the root), converts the root from a decimal field element to a left-padded 32-byte hex value (the contract's `bytes32` type), stores it, then static-calls `verifyDonation` with dummy proof points but the *correct* public signal. The mock accepts any proof, so what's actually asserted is the contract's root-matching path returning true.
- **TC-04** calls `verifyDonation` against batch 999 and asserts the existence revert.
- **TC-05** hashes the donation once unmodified and once with the amount altered, asserting the two commitments differ — the tamper-evidence property, no chain interaction.
- **TC-06** generates ten synthetic commitments, pads the list to sixteen (a power of two), folds it level by level — hashing adjacent pairs — into a single root, stores that root, and asserts the transaction succeeded. This is the batching mechanism in miniature: ten donations, one storage write.
- **TC-07** switches from chain to filesystem: it checks the ZK pipeline's output directory for the compiled constraint system, the witness-generator WASM, and the proving key, then parses the proof file and asserts it declares the Groth16 protocol over the BN254 curve with the expected three proof points, and that the public-signal file contains one non-zero value. If the pipeline has never been run on this machine the test marks itself skipped rather than failing — the same convention every artifact-dependent suite uses.
- **TC-08/TC-09** store a known root, then static-call verification with a matching public signal (asserts true) and transact with a mismatched one (asserts the `"Public signal does not match stored root"` revert). The mock would accept either proof, so TC-09 specifically isolates the contract's own equality check.
- **TC-10** repeats the access-control rejection so the matrix is complete in one suite.

### 1.3 `scalability.test.js`

**Imports:** mocha, chai, Hardhat, circomlibjs.

**Setup (`before`):** Poseidon initialization plus one MockVerifier/AidVocate deployment — sufficient because these tests measure storage gas and CPU time, never proof verification.

**Process:** the suite iterates over batch sizes 10, 100, 500, 1,000 — generating a `describe` block per size. For each size it derives the tree depth as the ceiling of log₂(n) (4, 7, 9, 10), synthesizes that many donation commitments with varied fields, then builds the complete Merkle tree — padding to 2^depth zero-leaves and folding pairwise — **three times**, recording wall-clock per run and printing the mean (the methodology's repeat-and-average requirement). The resulting root is then stored on-chain and the receipt's `gasUsed` printed, demonstrating empirically that the figure (53,097 warm) does not vary with batch size. A final test measures a live `storeMerkleRoot` transaction and computes the batching savings arithmetic from that measured figure — 1,000 individual writes versus one — asserting the savings exceed 90% (measured: 99.9%).

### 1.4 `onchain-verify.test.js` (real Groth16)

**Imports:** mocha, chai, Hardhat, filesystem/path utilities.

**Setup (`before`):** resolves the circuit build directory relative to the test file, and *skips the whole suite* if the pipeline-produced proof or the exported verifier contract is absent. Otherwise it parses the proof and public-signal JSON, converts the public root into a `bytes32`, deploys the **real** snarkjs-exported verifier (`Groth16VerifierFresh`) — an actual implementation of the Groth16 pairing check over the EVM's elliptic-curve precompiles — and deploys AidVocate pointing at it.

**Calldata preparation:** a helper reshapes the snarkjs proof into the verifier's expected argument layout. The notable transformation is on the G2 point: snarkjs serializes its coordinate pairs in the opposite order from what EVM verifiers expect, so the inner coordinates are swapped — the standard snarkjs→Solidity convention.

**Process:** test one stores the proof's root (printing the measured first-write gas, 70,197). Test two first *static-calls* `verifyDonation` to read its boolean (true — the pairing check passed against real cryptography), then sends the same call as a transaction to capture total gas (218,720, dominated by the pairing precompile). Test three stores a *different* root as a second batch and submits the same valid proof against it: the contract's public-signal equality check fails and the transaction reverts — demonstrating a proof cannot be replayed against a batch it doesn't belong to.

### 1.5 `plonk-verify.test.js` (real PLONK)

**Imports/setup:** same pattern — skip if the PLONK pipeline artifacts or exported verifier are missing. Instead of reconstructing calldata from the proof JSON, this suite reads the calldata file the pipeline exported via snarkjs's own calldata generator (two adjacent JSON arrays: 24 proof words — nine G1 points and six polynomial evaluations — plus the public signals), inserts the missing separator, parses it, sanity-checks the 24-element shape, and deploys `PlonkVerifierFresh`.

**Process:** the PLONK verifier is a pure view function, so validity is read with a direct call (true) and cost with gas estimation rather than a transaction (293,366). A second test increments the public signal by one and asserts verification now returns false.

### 1.6 `zokrates-verify.test.js` (real ZoKrates/Groth16)

**Imports/setup:** skip-if-absent; parses ZoKrates' proof JSON, whose structure differs from snarkjs — proof points `a`/`b`/`c` already in EVM order plus a separate inputs array, all hex-encoded — and assembles them into the nested tuple the exported `verifyTx` function takes. Deploys `ZoKratesVerifierFresh` (the `zokrates export-verifier` output, which embeds the circuit's verification key as contract constants).

**Process:** calls `verifyTx` with the real proof and public input (true), estimates gas (234,529), then re-calls with the public input incremented by one — the pairing equation no longer balances and the function returns false.

### 1.7 `honk-verify.test.js` (real UltraHonk/Noir)

**Imports/setup:** skip-if-absent, pointing at the Noir pipeline's *keccak* output directory — the detail that makes this measurable at all. Barretenberg proofs default to an internal transcript hash optimized for recursive proving, which an EVM contract cannot recompute; the pipeline therefore re-proves with a keccak transcript specifically for on-chain use. The suite reads the proof as raw bytes (hex-encoded into a `bytes` argument) and slices the public-inputs file into consecutive 32-byte words (a `bytes32` array). It deploys `HonkVerifier` from the bb-generated source — a ~1,900-line contract implementing the full Honk verification (sumcheck plus a polynomial-commitment opening check) in Solidity, which is why it needs solc ≥0.8.27 and a config override.

**Process:** calls `verify` with the proof bytes and public inputs (true), estimates gas (2,385,342 — about 10.9× Groth16, the structural price of Honk's prover-friendly design), then flips the public input. Depending on which internal check trips first the verifier either returns false or reverts with a named error, so the tamper test accepts either outcome as a rejection.

---

## 2. Benchmark pipelines (`circuits/scripts/`)

The four pipelines are Bash scripts executed inside Docker containers so the toolchain versions are pinned and the runs are reproducible. They share conventions: the repository's `circuits/` directory is bind-mounted into the container; every script enables fail-fast mode so a failed stage aborts the run rather than producing partial numbers; stages are numbered and announced; and each cryptographic stage is wrapped in a loop of **five timed runs**, with per-run wall-clock printed in milliseconds (timestamps taken from the shell's nanosecond clock before and after each invocation).

### 2.1 `docker-zk-pipeline.sh` (Circom + Groth16)

Runs in a Node.js 20 container under linux/amd64 (QEMU-emulated on Apple Silicon, which is why its absolute timings are upper bounds). The stages:

1. **Tooling** — downloads the pinned circom 2.1.9 binary if absent; snarkjs 0.7.6 runs through Node.
2. **Compile** — circom compiles `DonationVerifier.circom` into an R1CS constraint system, a WebAssembly witness generator, and a symbol table; snarkjs prints the constraint statistics (2,751 non-linear constraints).
3. **Trusted setup** — downloads the public Hermez Powers-of-Tau file (2^14) if absent; snarkjs's Groth16 setup specializes it to this circuit (Phase 2), one contribution is applied, and the verification key is exported.
4. **Witness** (×5 timed) — the WASM generator evaluates the circuit on `build/input.json`, producing the witness vector.
5. **Prove** (×5 timed) — snarkjs produces the Groth16 proof and public-signal files from the proving key and witness.
6. **Verify** (×5 timed) — snarkjs checks the proof against the verification key (prints OK).
7. **Artifact sizes** — lists proof/key/WASM sizes for the report.

### 2.2 `docker-plonk-pipeline.sh` (Circom + PLONK)

Same container type and circuit; differences in process:

- snarkjs is taken from the host-installed `node_modules` (mounted into the container) rather than fetched per-call — package-manager network calls inside the emulated container proved unreliable.
- **Setup** uses PLONK's *universal* setup: no contribution phase; the Powers-of-Tau file is consumed directly. The script first tries the 2^14 file; snarkjs rejects it because PLONK's row count for this circuit is 32,063 (≈11.7× the R1CS count — PLONK rows include the wide Poseidon additions that R1CS absorbs into linear combinations), so the script falls back to downloading the 2^16 file and retries. Setup is then timed ×5.
- **Witness** is generated once with the same WASM generator (identical circuit, so it's shared work, not re-timed).
- **Prove/verify** ×5 timed as above, with PLONK's larger proof (2,245 bytes vs 807).
- **Export** — snarkjs renders the Solidity verifier from the PLONK key and emits the calldata file `plonk-verify.test.js` consumes.

### 2.3 `docker-zokrates-pipeline.sh` (ZoKrates + Groth16)

Runs in the official ZoKrates 0.8.8 image (amd64). Process: locate the `zokrates` binary and stdlib inside the image; verify the argument file produced by `gen-toolchain-inputs.js` exists (aborting with instructions if not); **compile** the `.zok` port (ZoKrates reports 2,752 constraints — within one of the Circom circuit); **setup** (Groth16/BN254, ×5 timed); **compute-witness** (×5 timed) passing the 25 private inputs as command-line arguments in declaration order; **generate-proof** (×5 timed); **verify** (×5 timed, prints PASSED); **export-verifier** rendering the Solidity contract from the verification key; then print the proof's public output — the computed Merkle root, which is compared against the canonical root from `input.json` to confirm ZoKrates' stdlib Poseidon is circomlib-compatible (it is: identical root).

### 2.4 `docker-noir-pipeline.sh` (Noir + UltraHonk)

Runs in a plain Ubuntu 24.04 container **natively on arm64** (the Noir toolchain ships aarch64 builds, unlike circom — and native execution matches the benchmark environment's aarch64 kernel). Process: install the pinned toolchain via the official installers (nargo 1.0.0-beta.6, Barretenberg bb 0.84.0) and print versions; **compile** the Noir package (the Poseidon dependency is fetched from its git registry on first compile) into ACIR bytecode, with bb reporting the gate counts (3,664 ACIR opcodes; 10,606 finalized circuit rows); **no setup stage** — printed explicitly as not applicable, since UltraHonk has no circuit-specific setup; **execute** (×5 timed) evaluates the program on `Prover.toml` to produce the witness; **prove** (×5 timed) with bb's UltraHonk scheme (first run additionally downloads the universal SRS, so its time is reported but understood as a one-off); **write-vk and verify** (×5 timed, prints success); **EVM stage** — re-proves with the keccak transcript flag, writes the matching verification key, re-verifies, and exports the Solidity verifier for `honk-verify.test.js`; finally prints the public output (again the identical Merkle root) and artifact sizes (14,080-byte proof).

---

## 3. Supporting scripts

### 3.1 `circuits/scripts/gen-input.js`

A Node script that fabricates a *valid* witness for the depth-10 circuit. It initializes circomlibjs Poseidon, hashes a fixed sample donation into a commitment, then models that commitment sitting at leaf index 0 of an otherwise-empty tree: it precomputes the chain of "all-zero subtree" hashes (the zero leaf, the hash of two zero-leaves, and so on, ten levels up), uses those as the sibling path, folds the commitment up the tree to obtain the root, and writes everything — the five donation fields, ten path elements, ten path indices (all zero, since the leaf is leftmost), and the root — as decimal strings into `build/input.json`. Every pipeline proves against this one file, which is what makes the cross-toolchain "identical root" comparison meaningful.

### 3.2 `circuits/scripts/gen-toolchain-inputs.js`

Reads `input.json` and re-serializes it per toolchain: a single line of 25 space-separated decimal values (declaration order) for ZoKrates' command-line witness interface, and a TOML file (scalars plus two string arrays) for Noir's prover. The root itself is deliberately *not* emitted — both ports return the computed root as a public output, so the toolchains never need a pre-agreed root encoding.

### 3.3 `contracts/scripts/benchmark-merkle.js`

A standalone Node benchmark (no chain involved) for off-chain costs. For batch sizes 10/50/100/250/500/1,000 it times two phases separately with the process's high-resolution clock: generating n Poseidon-5 commitments, and folding them (padded to the next power of two) into a Merkle root with Poseidon-2. Output is a CSV-style line per size — the source of the construction-time table, showing linear scaling to ~150 ms at 1,024 leaves with commitment hashing dominating tree hashing.

### 3.4 `contracts/scripts/weight-sensitivity.js`

A pure-computation Node script (no dependencies) that re-implements the evaluation's multi-criteria methodology and stress-tests it. It embeds three datasets: the hash-function benchmark, and the framework benchmark under both this run's timings and the original run's timings. For each dataset it:

1. **Normalizes** each metric to the 0–1 range by min-max scaling, direction-aware (lower-is-better metrics invert), passing through metrics that are already 0–1 scores; a candidate missing a metric simply has that criterion's weight excluded and the remaining weights renormalized — the documented treatment of unmeasured values.
2. **Reproduces the baseline ranking** under the published weights (weighted sum of normalized metrics).
3. **Sweeps the full weight space**: enumerates every weight vector on a 0.05 grid (each criterion at least 0.05, summing to 1 — 969 combinations for four criteria), recomputes the ranking under each, and tallies how often every candidate finishes first, printing an example weight vector for any upset.
4. **Perturbs one weight at a time** by ±0.10 (rescaling the others proportionally) and reports whether the winner changes.
5. **Finds flip thresholds**: for each criterion, raises its weight in 0.01 steps (rest proportional) until the winner changes, reporting the crossover — or that none exists in the whole range.

### 3.5 `circuits/scripts/security-analysis.sh`

A wrapper that checks Circomspect is installed (with install instructions if not), runs it against `DonationVerifier.circom` with the library include path set, and tees the findings into a report file — the automated half of the circuit security review.

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
