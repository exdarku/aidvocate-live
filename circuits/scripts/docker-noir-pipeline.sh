#!/bin/bash
# Noir + UltraHonk (Barretenberg) pipeline benchmark.
# Runs NATIVE arm64 on Apple Silicon hosts (matching the evaluation
# environment's aarch64 linuxkit kernel) — noirup/bbup ship aarch64 builds,
# unlike circom. Versions pinned to the evaluation toolchain.
#
# Mirrors docker-zk-pipeline.sh: compile -> execute (witness) -> prove ->
# verify, with 5 timed runs per stage and loud failure (no fake numbers).
# No trusted-setup stage: n/a (UltraHonk has no circuit-specific setup).
#
# Prerequisites: node circuits/scripts/gen-toolchain-inputs.js (writes
# noir/Prover.toml from build/input.json).
#
# Run:
#   docker run --rm -v "$PWD/circuits":/src -w /src/noir \
#     ubuntu:24.04 bash /src/scripts/docker-noir-pipeline.sh
set -e
NARGO_VER=1.0.0-beta.6
BB_VER=0.84.0

echo "### 0. Tooling install (nargo ${NARGO_VER}, bb ${BB_VER})"
apt-get update -qq >/dev/null && apt-get install -y -qq curl git ca-certificates jq >/dev/null
export HOME=/root
curl -sSL https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash >/dev/null 2>&1
export PATH="$HOME/.nargo/bin:$PATH"
noirup -v ${NARGO_VER} >/dev/null 2>&1
nargo --version
curl -sSL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash >/dev/null 2>&1
export PATH="$HOME/.bb:$PATH"
bbup -v ${BB_VER} >/dev/null 2>&1 || bbup --version ${BB_VER} >/dev/null 2>&1
bb --version

cd /src/noir
if [ ! -f Prover.toml ]; then
  echo "ERROR: Prover.toml missing — run: node circuits/scripts/gen-toolchain-inputs.js" >&2
  exit 1
fi

echo "### 1. Compile (ACIR)"
S=$(date +%s%N)
nargo compile
E=$(date +%s%N)
echo "compile_ms=$(( (E - S) / 1000000 ))"
echo "--- gate count (UltraHonk) ---"
bb gates -b target/donation_verifier.json | tail -20 || true

echo "### 2. Trusted setup"
echo "n/a (UltraHonk — no circuit-specific setup)"

echo "### 3. Witness execution (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  nargo execute witness >/dev/null
  E=$(date +%s%N)
  echo "witness_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 4. UltraHonk proof generation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  bb prove --scheme ultra_honk -b target/donation_verifier.json -w target/witness.gz -o target/ >/dev/null
  E=$(date +%s%N)
  echo "prove_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 5. Verification key + UltraHonk verify (timed, 5 runs)"
bb write_vk --scheme ultra_honk -b target/donation_verifier.json -o target/ >/dev/null
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  bb verify --scheme ultra_honk -k target/vk -p target/proof -i target/public_inputs
  E=$(date +%s%N)
  echo "verify_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 6. EVM artifacts: keccak-transcript proof + Solidity verifier"
# On-chain verification needs a keccak transcript (the default proves with a
# Poseidon-flavored oracle for cheap recursion, which the EVM verifier does
# not accept). Re-prove with --oracle_hash keccak and export HonkVerifier.sol.
mkdir -p target/keccak
bb prove --scheme ultra_honk --oracle_hash keccak -b target/donation_verifier.json -w target/witness.gz -o target/keccak/ >/dev/null
bb write_vk --scheme ultra_honk --oracle_hash keccak -b target/donation_verifier.json -o target/keccak/ >/dev/null
bb verify --scheme ultra_honk --oracle_hash keccak -k target/keccak/vk -p target/keccak/proof -i target/keccak/public_inputs
if ! bb write_solidity_verifier --scheme ultra_honk -k target/keccak/vk -o target/keccak/HonkVerifier.sol; then
  echo "write_solidity_verifier unavailable; trying legacy command"
  bb contract_ultra_honk -k target/keccak/vk -o target/keccak/HonkVerifier.sol
fi
ls -l target/keccak/

echo "### 7. Public output (computed Merkle root — compare to build/input.json merkleRoot)"
ls target/
echo "public_inputs (hex):"
od -A n -t x1 target/public_inputs | tr -d ' \n'; echo

echo "### 8. Artifact sizes"
ls -l target/proof target/vk target/public_inputs target/donation_verifier.json
echo "ALL DONE"
