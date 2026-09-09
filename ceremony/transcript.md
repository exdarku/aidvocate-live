# AidVocate — Groth16 trusted setup transcript

This file records, exactly and without embellishment, how the Groth16 proving and
verification keys for `circuits/circuits/DonationVerifier.circom` are generated in
this repository.

## Summary

**The Phase 2 setup has one (1) contribution. It was performed by the project team
on a single machine, with an entropy string hardcoded in
`circuits/scripts/trusted-setup.sh`. There was no multi-party ceremony, no
independent external contributor, and no public randomness beacon.**

Soundness of Groth16 requires at least one contributor to have destroyed their
share of the trapdoor. Because the entropy string is published in this repository,
the contribution is reproducible by anyone who reads it, and there is effectively
no secret to destroy. This is a **known limitation and a deployment blocker**; it
is recorded as finding F1 in `docs/EVALUATION.md`.

This setup is suitable for development, benchmarking, and testnet use. It is not
suitable for production. A production deployment must re-run Phase 2 as a genuine
multi-party ceremony with independent contributors and a public verifiable beacon,
and must publish the resulting verification-key hash.

## Phase 1 (Powers of Tau)

Phase 1 was **not** run by this project. The universal `pot14.ptau` is downloaded
by `circuits/scripts/trusted-setup.sh` from the public perpetual Powers of Tau
ceremony:

    https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

That ceremony's own transcript and contributor set are published by its
maintainers and are outside the scope of this repository. Phase 1 trust is
inherited from it. The single-contributor limitation described above concerns
**Phase 2 only**.

## Phase 2

Performed by `circuits/scripts/trusted-setup.sh`, which runs, in order:

1. `snarkjs groth16 setup build/DonationVerifier.r1cs ptau/pot14.ptau build/DonationVerifier_0000.zkey`
2. `snarkjs zkey contribute build/DonationVerifier_0000.zkey build/DonationVerifier.zkey --name="AidVocate Phase 2 contribution" -v -e="aidvocate trusted setup entropy"`
3. `snarkjs zkey export verificationkey build/DonationVerifier.zkey build/verification_key.json`

Step 2 supplies entropy via a **hardcoded `-e` string committed to this
repository**. The contribution must therefore not be treated as secret randomness.

There is no `snarkjs zkey beacon` step. No beacon is applied at any point.

## Circuit compiled for this transcript

    $ circom circuits/DonationVerifier.circom --r1cs --wasm --sym -o build/ -l node_modules
    template instances: 146
    non-linear constraints: 2784
    linear constraints: 3251
    public inputs: 1
    private inputs: 25
    public outputs: 0
    wires: 6051
    labels: 9102

    $ snarkjs r1cs info build/DonationVerifier.r1cs
    [INFO]  snarkJS: Curve: bn-128
    [INFO]  snarkJS: # of Wires: 6051
    [INFO]  snarkJS: # of Constraints: 6035
    [INFO]  snarkJS: # of Private Inputs: 25
    [INFO]  snarkJS: # of Public Inputs: 1
    [INFO]  snarkJS: # of Labels: 9102
    [INFO]  snarkJS: # of Outputs: 0

The deployed circuit is **6,035 R1CS constraints**. (The 321-constraint figure
reported for Poseidon in the paper's Table 1 is the cost of the Poseidon
commitment primitive alone, not of this full circuit, which additionally verifies
a depth-10 Merkle path.)

## Verification output

Reproduce with:

    cd circuits
    snarkjs zkey verify build/DonationVerifier.r1cs ptau/pot14.ptau build/DonationVerifier.zkey

Captured output is in `zkey_verify_output.txt`. The contribution chain is:

    contribution #1 AidVocate Phase 2 contribution:
        5e456c06 3126c4e8 93fffeb0 ebb2f03d
        30a222a6 ec0be614 65049962 6eef3edc
        11bc18c2 67a314a1 16d2cc16 2e8f0d64
        16f12436 d37c74ab e1d048e7 31869235

    ZKey Ok!

Circuit hash:

    e4422772 e007366e 055bffe3 d8d7d149
    3dfa2d78 5f1af0df 5788e3dd ba79a122
    02b5309e dc0873ea 0c8376ad 257964a1
    86002d8b 20d7af10 80ea7aa2 b5cce1f7

The chain contains exactly one entry. A beacon, had one been applied, would appear
as an additional entry.

## Beacon

**No beacon was applied.** `snarkjs zkey beacon` is not invoked anywhere in this
repository:

    $ grep -rn "beacon" --include=*.mjs --include=*.js --include=*.sh . | grep -v node_modules
    (no matches)

Any claim that a final beacon is derived from a specific Ethereum block hash is
**not supported by this transcript**.

## Reproducibility note

`snarkjs zkey contribute` mixes the supplied `-e` entropy with additional system
randomness, so re-running the setup produces a different contribution hash and a
different final `.zkey` each time. The pre-contribution `DonationVerifier_0000.zkey`
is deterministic for a given circuit and ptau. Consequently the contribution hash
above identifies this specific run, not every run of the script.

## Artifact hashes (SHA-256) for this run

    ee19997b0a22d4deb31e47d1a84ddc84e06b9294cf4d38978e1e03fa8379cf17  circuits/build/DonationVerifier.zkey
    89dcfceaa6b57de5d09b9877cb9110dead668a2e0331473935703e4f07bed849  circuits/build/DonationVerifier_0000.zkey
    5a9411321d42ee9a5afa394e2b6c764c97b9238692ca0b660b68030eb67c69cf  circuits/build/DonationVerifier.r1cs
    489be9e5ac65d524f7b1685baac8a183c6e77924fdb73d2b8105e335f277895d  circuits/ptau/pot14.ptau

Generated 2026-09-09 on the pinned `aidvocate/circom-toolchain` image
(circom 2.2.2, snarkjs 0.7.6, node 20).
