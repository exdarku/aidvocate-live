# AidVocate — Architecture Evaluation

**System under test:** Privacy-preserving donation verification using zero-knowledge proofs (Circom / Groth16) and Merkle-tree batching, with a Solidity smart-contract layer (Hardhat) and an Express/MySQL backend.

**Question:** Is the implemented architecture viable for real-world deployment?

**Method:** (1) functional and scalability testing — correctness plus gas, proof-generation, and tree-construction metrics across batch sizes; (2) security analysis — Slither on the smart contracts and Circomspect + manual review on the ZKP circuit.

**Date:** 2026-06-03

---

## 1. Methodology & Environment

| Component | Detail |
|---|---|
| Host | macOS (Apple Silicon, arm64), Node.js v24.10.0 |
| Contracts | Hardhat 3.1.10, Solidity 0.8.20 (optimizer on, 200 runs), Mocha + Chai + ethers v6 |
| Circuit | Circom 2.1.9, Groth16 over BN254, snarkjs 0.7.6, circomlib 2.0.5 |
| Trusted setup | Powers-of-Tau `powersOfTau28_hez_final_14` (2^14), single Phase-2 contribution |
| Static analysis | Slither 0.11.5 (solc 0.8.20), Circomspect 0.9.0 |
| Containers | Docker 29.0.1 — `trailofbits/eth-security-toolbox` (Slither), `node:20-bookworm` (circom/snarkjs, linux/amd64 emulated), `rust:1-slim-bookworm` (Circomspect, native arm64) |

**Reproducibility — scripts added by this evaluation:**
- `contracts/scripts/benchmark-merkle.js` — Merkle construction benchmark across batch sizes.
- `circuits/scripts/gen-input.js` — generates a valid proof input (`build/input.json`).
- `circuits/scripts/docker-zk-pipeline.sh` — compile → trusted setup → witness → prove → verify (timed) in Docker.
- `contracts/test/onchain-verify.test.js` — deploys the real Groth16 verifier and measures `verifyDonation` gas (skips if ZK artifacts are absent).

> **Timing caveat.** The circuit pipeline ran inside a linux/amd64 container under QEMU emulation on arm64. Witness/proof/verify wall-clock times below are therefore **conservative upper bounds**; native execution is materially faster. On-chain gas and constraint counts are exact and platform-independent.

---

## 2. Functional Testing — correctness

End-to-end correctness was verified at three layers; **all 23 contract tests pass** plus off-chain proof verification.

| Layer | What was checked | Result |
|---|---|---|
| Off-chain crypto | Poseidon commitment determinism, Merkle tree build, proof for a valid member | ✅ TC-01…TC-06 pass |
| ZK proof (snarkjs) | Witness generation + Groth16 prove + `groth16 verify` of the generated proof | ✅ `snarkjs ... OK!` |
| On-chain (mock) | Root storage, event emission, access control, mismatched-root rejection | ✅ TC-07…TC-10 pass |
| **On-chain (real Groth16)** | Deployed the actual verifier, submitted a real proof → `verifyDonation` returns **true**; a tampered public signal **reverts** | ✅ pass |

Negative paths behave correctly: invalid commitments are rejected (TC-04), tampered donation data is detected (TC-05), non-owners cannot store roots (TC-10), verification against a non-existent batch reverts, and a public signal that does not match the stored root reverts (`"Public signal does not match stored root"`, `AidVocate.sol:49`).

**Verdict: functional correctness confirmed end-to-end (off-chain → ZK → on-chain).**

---

## 3. Scalability & Performance

### 3.1 Circuit size (exact)

| Metric | Value |
|---|---|
| Non-linear (R1CS) constraints | **2,751** |
| Wires | 2,767 |
| Private inputs | 25 (5 donation fields + 10 path elements + 10 path indices) |
| Public inputs | 1 (`merkleRoot`) |
| Template instances | 146 |
| Curve / system | BN254 / Groth16 |

The circuit is **fixed at Merkle depth 10 (≤ 1024 donations per batch)**, so constraint count, proving time, and proof size are **constant regardless of how full a batch is**. Batches larger than 1024 require either multiple batches or recompilation at a higher depth.

### 3.2 Proof pipeline (timed, 5 runs each; emulated — upper bounds)

| Stage | Mean | Range |
|---|---|---|
| Witness generation | ~395 ms | 390–401 ms |
| Groth16 proof generation | ~3.6 s | 3.11–4.19 s |
| `snarkjs groth16 verify` (CLI) | ~2.9 s* | 2.81–3.01 s |

\* The CLI verify time is dominated by Node/WASM start-up under emulation, **not** the cryptographic verification (which is a few milliseconds at the library level). The meaningful verification cost is the **on-chain gas** in §3.3.

| Artifact | Size |
|---|---|
| Proving key (`.zkey`) | 1.9 MB |
| Verification key (`.json`) | 2.9 KB |
| Witness generator (`.wasm`) | 2.4 MB |
| **Proof** (`proof.json`) | **807 bytes** (constant — 3 curve points) |
| Public signals | 84 bytes |
| Powers-of-Tau (2^14) | 19 MB |

### 3.3 On-chain gas (exact, measured)

| Operation | Gas | Scales with batch size? |
|---|---|---|
| `storeMerkleRoot` (first/cold) | **70,197** | **No — O(1)** |
| `storeMerkleRoot` (subsequent/warm) | 53,097 | No — O(1) |
| `verifyDonation` (real Groth16 pairing + checks + event) | **218,720** | No — O(1) |

**Rough cost on Polygon** (≈30 gwei, MATIC ≈ $0.50, illustrative only — gas price is volatile): storing a root ≈ $0.001; an on-chain verification ≈ $0.003. Effectively negligible per batch.

> **Correction to the existing test.** `contracts/test/scalability.test.js` labels root storage as "~22,000 gas constant" and computes a "99.9% savings" from an assumed 22,000 gas/donation. The **measured** transaction cost is ~53–70k gas. The *qualitative* claim is sound and important — **on-chain cost is constant per batch (O(1)) rather than linear in the number of donations (O(N))** — but the specific 22,000 figure is illustrative, not measured. The report uses the measured numbers.

### 3.4 Off-chain Merkle construction (native, host)

| Batch | Depth | Leaves | Commit gen | Tree build | Total |
|---:|---:|---:|---:|---:|---:|
| 10 | 4 | 16 | 1.5 ms | 0.8 ms | 2.4 ms |
| 50 | 6 | 64 | 5.5 ms | 3.1 ms | 8.6 ms |
| 100 | 7 | 128 | 10.5 ms | 6.2 ms | 16.6 ms |
| 250 | 8 | 256 | 26.2 ms | 12.3 ms | 38.5 ms |
| 500 | 9 | 512 | 52.1 ms | 23.9 ms | 76.0 ms |
| 1000 | 10 | 1024 | 99.9 ms | 47.7 ms | 147.6 ms |

Construction is **linear in batch size** and modest — a full 1,024-donation batch builds in ~150 ms even in single-threaded JavaScript Poseidon. Commitment hashing (Poseidon-5) dominates over tree hashing (Poseidon-2).

> **Performance finding (server).** `getMerkleProof` (`server/src/services/merkle.js:58`) **rebuilds the entire tree on every proof request** (O(N) per call) and `buildMerkleTree` awaits each hash sequentially. At ~150 ms/rebuild for full batches this caps proof-serving throughput. Recommend caching the layers per batch and/or moving hashing to a native/worker implementation.

**Verdict:** On-chain scalability is excellent (constant gas per batch, sub-cent cost). Off-chain work is linear and small; the practical throughput ceiling is server-side proof generation and the repeated tree rebuild, both addressable.

### 3.5 Cross-toolchain comparison (ZoKrates, Noir, PLONK)

**Date:** 2026-06-06. The same donation-verification statement (Poseidon-5 commitment + depth-10 Poseidon-2 Merkle path → public root) was implemented and benchmarked in three additional framework/proving-system combinations alongside the production Circom+Groth16 pipeline. Ports: `circuits/zokrates/DonationVerifier.zok`, `circuits/noir/src/main.nr`; pipelines: `circuits/scripts/docker-{plonk,zokrates,noir}-pipeline.sh` (5 timed runs per stage, mean reported). The ZoKrates/Noir ports return the computed root as a public output instead of asserting a public input — semantically identical binding.

| | Circom + Groth16 (§3.2) | Circom + PLONK | ZoKrates + Groth16 | Noir + UltraHonk |
|---|---|---|---|---|
| Versions | circom 2.1.9, snarkjs 0.7.6 | same | ZoKrates 0.8.8 | nargo 1.0.0-beta.6, bb 0.84.0 |
| Container | amd64 (QEMU) | amd64 (QEMU) | amd64 (QEMU) | **native arm64** |
| Constraints | 2,751 R1CS | 32,063 PLONK rows | 2,752 R1CS | 3,664 ACIR opcodes (10,606 gates) |
| Trusted setup | per-circuit (Phase 2) | universal (pot16) | per-circuit | none |
| Setup time | — (one-off ceremony) | ~3,776 ms | ~206 ms | n/a |
| Witness | ~395 ms | shared with Groth16 | ~74 ms | ~126 ms |
| Prove | ~3.6 s | ~21.1 s | ~238 ms | ~170 ms* |
| Verify (CLI) | ~2.9 s | ~1.23 s | ~55 ms | ~17 ms |
| Proof size | 807 B | 2,245 B | 849 B | 14,080 B |
| **On-chain verify gas** | **218,720** (via AidVocate) | **293,366** (bare verifier) | not measured | not measured |

\* First Noir prove run was 3,967 ms (one-time SRS download); warm-run mean reported.

Notes: (1) emulated-container timings are conservative upper bounds and not directly comparable to the native-arm64 Noir run; gas, constraint counts, and proof sizes are platform-independent. (2) All three ports compute the **identical Merkle root** to the Circom circuit — the ZoKrates stdlib and noir-lang/poseidon implementations are circomlib-compatible. (3) PLONK's universal setup avoids the per-circuit ceremony (F1) but costs ~2.8× proof size and ~34% more verification gas than Groth16 — consistent with the design choice of Groth16 for the production stack. (4) The PLONK verifier was deployed and exercised on-chain (`contracts/test/plonk-verify.test.js`): valid proof accepted, tampered public signal rejected.

---

## 4. Security Analysis

### 4.1 Smart contracts — Slither 0.11.5

| Contract | High | Medium | Low | Informational |
|---|---:|---:|---:|---:|
| `AidVocate.sol` (project code) | 0 | 0 | 0 | 7 |
| `Groth16Verifier.sol` (snarkjs-generated) | 3* | 0 | 0 | 43 |

- **`AidVocate.sol`: clean.** The only findings are 7 `naming-convention` (informational) for leading-underscore parameter names. No reentrancy, access-control, or arithmetic findings. Manual review confirms: state is updated before event emission, the only external call is a `staticcall` to a view verifier, `storeMerkleRoot` is `onlyOwner`, and roots are append-only (each `batchId = batchCount++` is a fresh slot, never overwritten).
- **`Groth16Verifier.sol`: the 3 "High" `incorrect-return` are false positives.** They flag the `mstore(0, …); return(0, 0x20)` idiom in inline assembly (`Groth16Verifier.sol:63-64, 79-81, 88-91`). This is the **standard, unmodified snarkjs verifier pattern** — it writes the boolean result to memory and returns it from the whole `verifyProof` call; it is intentional and used unchanged across the ecosystem. The remaining 43 findings are informational (expected `assembly` usage, generated-code naming, and a broad `>=0.7.0 <0.9.0` pragma).

### 4.2 ZKP circuit — Circomspect 0.9.0 + manual review

**Circomspect:** `No issues found` (both `DonationVerifier` and `MerkleTreeVerifier` templates analyzed).

**Manual review — soundness (positive):**
- Path indices are **constrained binary** — `pathIndices[i] * (1 - pathIndices[i]) === 0` (`DonationVerifier.circom:19`) — preventing forged non-binary indices.
- The left/right conditional swap (`:23-24`) is the correct multiplexer and is fully constrained (`<==`).
- The public root is **bound** to the computed root — `merkleRoot === merkleVerifier.root` (`:58`).
- **No dangling `<--` assignments** (the classic under-constraint bug); every signal is constrained.

### 4.3 Findings (by severity)

| # | Severity | Area | Finding | Recommendation |
|---|---|---|---|---|
| F1 | **High (deployment blocker)** | Circuit / ceremony | The trusted setup (`circuits/scripts/trusted-setup.sh`, and the benchmark pipeline) performs a **single Phase-2 contribution with a hardcoded, public entropy string** (`-e="aidvocate trusted setup entropy"`). Groth16 soundness requires at least one honest contributor to destroy the toxic waste; public entropy means it is effectively known, so **anyone could forge proofs for any root**, collapsing the ZK guarantee. | Run a real multi-party ceremony with several independent contributors and a public verifiable beacon; publish and pin the resulting verification-key hash. |
| F2 | **Medium** | Contract / circuit | **No nullifier / replay protection.** `verifyDonation` can be replayed with the same proof and emits `DonationVerified` each time; the public signal is only the root, so a proof attests that *some* committed donation exists under the root, not which one. Any party holding one valid witness can emit unlimited verifications. | Add a nullifier (e.g., `Poseidon(salt, …)`) as a public output, track spent nullifiers on-chain, and reject reuse — if the use-case counts/claims per donation. |
| F3 | **Medium** | Circuit | **No range constraints** on `amount`, `donorId`, etc. — they are arbitrary field elements; integrity relies on honest off-chain batch construction. | If batch construction is trusted, document the assumption; otherwise add range checks (e.g., `amount < 2^64`). |
| F4 | **Medium** | Backend / ops | `server/src/services/blockchain.js:5` defaults `DEPLOYER_PRIVATE_KEY` to the **well-known public Hardhat account-0 key with no production fail-fast** (unlike `config.js`, which throws on missing secrets in prod). An unset env var in production silently signs with a publicly known key. | Add the same prod guard `config.js` uses; never fall back to a known key. |
| F5 | **Low** | Contract | Single-owner centralization: the deployer EOA controls all root submissions; key compromise lets an attacker store arbitrary roots. | Use a multisig/timelock as `owner`. |
| F6 | **Low** | Contract | `verifyDonation` is a state-changing tx (emits an event) returning `bool`; off-chain callers cannot read the return value without parsing the event/trace. | Make verification `view` and emit/record acceptance separately, or rely solely on the event. |
| F7 | **Low** | Circuit | No explicit domain separation between leaf hashes (Poseidon-5) and node hashes (Poseidon-2). Differing arities make collisions impractical, but explicit tags are best practice. | Add a domain-separation constant per hash role. |
| F8 | **Low** | Repro / ops | The committed `Groth16Verifier.sol` embeds a verification key from a setup whose `.zkey` is not in the repo; proofs from a fresh setup will not verify against it (confirmed during this evaluation). | Commit the ceremony output reference (vkey hash) and regenerate the on-chain verifier from the canonical zkey. |
| F9 | **Info** | Contract | `Groth16Verifier.sol` pragma `>=0.7.0 <0.9.0` is broad. | Pin to `0.8.20`. |

**Positives observed:** `config.js` fails fast on missing/weak `JWT_SECRET` (min 32 chars) and required DB vars in production; CORS is configurable; MySQL TLS is available for RDS. Good operational hygiene on the web tier.

---

## 5. Deployment-Viability Verdict

| Dimension | Assessment |
|---|---|
| **Functional correctness** | ✅ Verified end-to-end (off-chain proof + on-chain Groth16 verification; negative paths revert correctly). |
| **Scalability / cost** | ✅ Strong. On-chain cost is **O(1) per batch** (~70k gas store, ~219k gas verify; sub-cent on Polygon) regardless of donation count. Off-chain tree build is linear and fast (~150 ms for 1,024). Proof size is constant (807 B). |
| **Security — primitives & logic** | ✅ Circuit constraints sound (Circomspect clean, manual review confirms binding + binary constraints); `AidVocate.sol` clean under Slither. |
| **Security — operational/ceremony** | ⚠️ **Not production-ready as-is.** The trusted-setup ceremony (F1) is a hard blocker; replay protection (F2) and key/owner hardening (F4, F5) are required. |

**Conclusion.** The architecture is **viable and the core design is sound** — the privacy model, Merkle batching, and constant on-chain cost are well-suited to real-world donation verification, and both functional and static-analysis results are clean. It is **not yet production-ready**. Before mainnet deployment the team must, in priority order:

1. **Perform a real multi-party trusted-setup ceremony** and regenerate/commit the on-chain verifier (F1, F8).
2. **Add nullifier-based replay protection** if donations are counted/claimed (F2).
3. **Harden key and ownership management** — production key guard + multisig owner (F4, F5).

With these addressed, the system is suitable for testnet-to-mainnet deployment. Secondary improvements (server-side proof-serving throughput, input range constraints, pragma pinning) can follow.

---

## 6. How to Reproduce

```bash
# Functional + scalability + real on-chain gas (needs ZK artifacts from the pipeline below for the real-verifier suite)
cd contracts && REPORT_GAS=true npx hardhat test
node scripts/benchmark-merkle.js

# ZK pipeline: compile, trusted setup, witness, prove, verify (timed)
cd ../contracts && node ../circuits/scripts/gen-input.js          # writes circuits/build/input.json
docker run --rm --platform linux/amd64 -v "$PWD/../circuits":/src -w /src node:20-bookworm \
  bash /src/scripts/docker-zk-pipeline.sh

# Slither
cd ../contracts && docker run --rm -v "$PWD":/src -w /src trailofbits/eth-security-toolbox \
  bash -lc 'solc-select install 0.8.20 && solc-select use 0.8.20 && slither contracts/AidVocate.sol \
  --solc-remaps @openzeppelin=node_modules/@openzeppelin'

# Circomspect (native arm64)
cd ../circuits && docker run --rm -v "$PWD":/src -w /src rust:1-slim-bookworm \
  bash -c 'export PATH=/usr/local/cargo/bin:$PATH; cargo install circomspect; \
  circomspect -L node_modules circuits/DonationVerifier.circom'
```
