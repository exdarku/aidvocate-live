#!/bin/bash
# ZoKrates + Groth16 pipeline benchmark, run inside the zokrates/zokrates
# image (linux/amd64; QEMU-emulated on arm64 hosts).
# Mirrors docker-zk-pipeline.sh: compile -> setup -> witness -> prove ->
# verify, with 5 timed runs per stage and loud failure (no fake numbers).
#
# Prerequisites: node circuits/scripts/gen-toolchain-inputs.js (writes
# zokrates/args.txt from build/input.json).
#
# Run:
#   docker run --rm --platform linux/amd64 -v "$PWD/circuits":/src -w /src \
#     zokrates/zokrates:0.8.8 bash /src/scripts/docker-zokrates-pipeline.sh
set -e
cd /src
OUT=build/zokrates
mkdir -p "$OUT"

ZOKRATES=$(command -v zokrates || echo /home/zokrates/.zokrates/bin/zokrates)
export ZOKRATES_STDLIB=${ZOKRATES_STDLIB:-/home/zokrates/.zokrates/stdlib}

echo "### 0. Tooling"
$ZOKRATES --version

if [ ! -f zokrates/args.txt ]; then
  echo "ERROR: zokrates/args.txt missing — run: node circuits/scripts/gen-toolchain-inputs.js" >&2
  exit 1
fi
ARGS=$(cat zokrates/args.txt)

echo "### 1. Compile (constraint count reported by ZoKrates)"
S=$(date +%s%N)
$ZOKRATES compile -i zokrates/DonationVerifier.zok -o "$OUT/out" --r1cs "$OUT/out.r1cs"
E=$(date +%s%N)
echo "compile_ms=$(( (E - S) / 1000000 ))"

echo "### 2. Trusted setup (Groth16, BN254; timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $ZOKRATES setup -i "$OUT/out" -p "$OUT/proving.key" -v "$OUT/verification.key" >/dev/null
  E=$(date +%s%N)
  echo "setup_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 3. Witness computation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $ZOKRATES compute-witness -i "$OUT/out" -o "$OUT/witness" -a $ARGS >/dev/null
  E=$(date +%s%N)
  echo "witness_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 4. Proof generation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $ZOKRATES generate-proof -i "$OUT/out" -w "$OUT/witness" -p "$OUT/proving.key" -j "$OUT/proof.json" >/dev/null
  E=$(date +%s%N)
  echo "prove_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 5. Proof verification (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $ZOKRATES verify -j "$OUT/proof.json" -v "$OUT/verification.key"
  E=$(date +%s%N)
  echo "verify_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 6. Public output (computed Merkle root — compare to build/input.json merkleRoot)"
grep -A4 '"inputs"' "$OUT/proof.json" || true

echo "### 7. Artifact sizes"
ls -lh "$OUT/out" "$OUT/proving.key" "$OUT/verification.key" "$OUT/proof.json" "$OUT/witness"
echo "ALL DONE"
