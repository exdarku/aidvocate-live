# ZK Toolchain Benchmark: ZoKrates + Noir — Design

**Date:** 2026-06-04
**Status:** Approved (approach A)
**Goal:** Extend the architecture evaluation with a cross-toolchain comparison: the same donation-verification statement implemented and benchmarked in ZoKrates and Noir alongside the existing Circom/Groth16 pipeline.

## Background

`docs/EVALUATION.md` benchmarks the production Circom circuit (`circuits/circuits/DonationVerifier.circom`) via `circuits/scripts/docker-zk-pipeline.sh` — compile → trusted setup → witness → prove → verify, timed inside a linux/amd64 Docker container (QEMU-emulated on the Apple Silicon host). ZoKrates and Noir appear nowhere in the repo today; benchmarking them requires re-implementing the circuit in each toolchain's own language, since neither consumes `.circom`.

## Scope

**In:** off-chain pipeline only — compile, setup (where applicable), witness/execute, prove, verify timings; constraint/gate counts; artifact sizes. Results added to `docs/EVALUATION.md` as a new §3.5 "Cross-toolchain comparison".

**Out:** on-chain verifier export/gas for ZoKrates and Noir; changing the production stack (Circom remains the system under test); native (non-Docker) runs.

## The statement being proven (identical across toolchains)

Same logical circuit as `DonationVerifier.circom`:

- Private inputs: 5 donation fields (donorId, amount, ngoId, timestamp, salt), 10 Merkle path elements, 10 path indices.
- Public input: `merkleRoot`.
- Constraints: `commitment = Poseidon(5 fields)`; recompute root from commitment + depth-10 Poseidon(2) path; assert equals public root.

Each implementation uses its toolchain's stdlib Poseidon. Poseidon round constants differ across implementations, so roots and constraint counts will not be bit-identical — the comparison is *toolchain ergonomics and performance for the same statement*, stated explicitly in §3.5. If a stdlib lacks a needed arity (e.g., Poseidon-5), compose from available arities and record the deviation in the doc.

## Repository layout (approach A — mirror existing pattern)

```
circuits/
  zokrates/
    DonationVerifier.zok          # ZoKrates port
    input-template.json           # witness inputs (generated values documented)
  noir/
    Nargo.toml                    # Nargo project manifest
    src/main.nr                   # Noir port
    Prover.toml                   # witness inputs
  scripts/
    docker-zk-pipeline.sh         # existing (circom) — untouched
    docker-zokrates-pipeline.sh   # new
    docker-noir-pipeline.sh       # new
```

Build outputs go to `circuits/build/zokrates/` and `circuits/build/noir/` (gitignored like the existing `build/`).

## Pipeline scripts

Both new scripts follow the structure and output format of `docker-zk-pipeline.sh`: numbered stages, `set -e`, loud failure (no fake numbers), and a timed section per stage with 5 runs (mean + range) for witness/prove/verify, matching §3.2's methodology.

### `docker-zokrates-pipeline.sh`

- Container: `zokrates/zokrates` (linux/amd64; emulated on arm64 like the circom run).
- Stages: `zokrates compile` → `zokrates setup` (Groth16, BN254) → `zokrates compute-witness` → `zokrates generate-proof` → `zokrates verify`.
- Reports: constraint count (from compile output), proving/verification key sizes, proof size, stage timings.
- Groth16 over BN254 — directly comparable to the snarkjs numbers.

### `docker-noir-pipeline.sh`

- Container: linux/amd64 with pinned Noir (`noirup -v <pinned>`) and matching Barretenberg `bb`.
- Stages: `nargo compile` → `nargo execute` (witness) → `bb prove` (UltraHonk) → `bb verify`.
- No trusted setup stage — reported as "n/a (UltraHonk, no circuit-specific setup)" and called out as a qualitative advantage.
- Reports: ACIR opcode / gate count, proof + vk sizes, stage timings.

Both scripts are invoked the same way as the existing one (`docker run --platform linux/amd64 -v "$PWD":/src … /src/scripts/<script>.sh`), with the exact command documented in a header comment.

## Versions (pinned in scripts)

- ZoKrates: latest published `zokrates/zokrates` image tag (effectively frozen — project dormant since ~2023; noted in doc).
- Noir/bb: pin a current stable pair at implementation time; record exact versions in §3.5's environment table.

## EVALUATION.md changes

New **§3.5 Cross-toolchain comparison**:

- Environment row additions (images, versions) to the §1 table.
- Comparison table: toolchain, language, proving system, setup required, constraint/gate count, compile/setup/witness/prove/verify timings (mean, 5 runs), proof size, key sizes.
- Honest framing notes: (1) all three pipelines under identical QEMU-emulated amd64 containers — same caveat as §3.2; (2) Noir/UltraHonk is not a Groth16 peer — no-setup and larger proofs are structural differences, not measurement noise; (3) Poseidon implementations differ across stdlibs; (4) ZoKrates maintenance status.

## Error handling

- Scripts fail loudly (`set -e`, explicit stage banners) — a missing image, network failure, or stdlib gap aborts the run rather than producing partial/fake numbers.
- Stdlib gaps (e.g., Poseidon arity) are resolved by composing available primitives; any such deviation is recorded in §3.5.

## Testing / verification

- Each pipeline must end with its own verifier accepting the generated proof (`zokrates verify` passes; `bb verify` passes) — that is the functional gate.
- Negative check per toolchain: tamper one public input and confirm verification fails.
- Timings recorded only from runs where verification passes.
