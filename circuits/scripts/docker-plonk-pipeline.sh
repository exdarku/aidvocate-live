#!/bin/bash
# Circom + PLONK pipeline benchmark, run inside node:20 (linux/amd64) container.
# Same circuit as the Groth16 pipeline; PLONK's universal setup needs no
# per-circuit contribution. Produces setup/prove/verify timings, artifact
# sizes, and a Solidity verifier + calldata for the on-chain gas test.
#
# Run:
#   docker run --rm --platform linux/amd64 -v "$PWD/circuits":/src -w /src \
#     node:20-bookworm bash /src/scripts/docker-plonk-pipeline.sh
#
# Requires build/input.json (node scripts/gen-input.js) and reuses the
# compiled circuit from the Groth16 pipeline if present.
set -e
cd /src
export NODE_OPTIONS=--max-old-space-size=4096
CIRCOM_VER=v2.1.9
SNARKJS="npx --yes snarkjs@0.7.6"
OUT=build/plonk
mkdir -p "$OUT"

echo "### 0. Tooling"
node --version
if ! command -v circom >/dev/null 2>&1; then
  echo "Installing circom ${CIRCOM_VER}..."
  curl -sSL -o /usr/local/bin/circom https://github.com/iden3/circom/releases/download/${CIRCOM_VER}/circom-linux-amd64
  chmod +x /usr/local/bin/circom
fi
circom --version

echo "### 1. Install circomlib"
if [ ! -d node_modules/circomlib ]; then
  npm init -y >/dev/null 2>&1 || true
  npm install --no-audit --no-fund circomlib@2.0.5 >/dev/null 2>&1
fi
echo "circomlib installed"

echo "### 2. Compile circuit (reuse Groth16 build if present)"
if [ ! -f build/DonationVerifier.r1cs ]; then
  circom circuits/DonationVerifier.circom --r1cs --wasm --sym -o build/ -l node_modules
fi
$SNARKJS r1cs info build/DonationVerifier.r1cs

echo "### 3. PLONK setup (universal — no contribution; timed, 5 runs)"
# PLONK needs a larger SRS than Groth16 for the same circuit (its row count
# exceeds the R1CS constraint count). Try pot14 first; fall back to pot16.
PTAU=ptau/pot14.ptau
mkdir -p ptau
if [ ! -f "$PTAU" ]; then
  echo "Downloading powers of tau (2^14)..."
  curl -sSL https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau -o "$PTAU"
fi
if ! $SNARKJS plonk setup build/DonationVerifier.r1cs "$PTAU" "$OUT/DonationVerifier_plonk.zkey"; then
  echo "pot14 too small for PLONK row count — falling back to pot16"
  PTAU=ptau/pot16.ptau
  if [ ! -f "$PTAU" ]; then
    echo "Downloading powers of tau (2^16)..."
    curl -sSL https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau -o "$PTAU"
  fi
  $SNARKJS plonk setup build/DonationVerifier.r1cs "$PTAU" "$OUT/DonationVerifier_plonk.zkey"
fi
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $SNARKJS plonk setup build/DonationVerifier.r1cs "$PTAU" "$OUT/DonationVerifier_plonk.zkey" >/dev/null
  E=$(date +%s%N)
  echo "setup_run_${i}_ms=$(( (E - S) / 1000000 ))"
done
$SNARKJS zkey export verificationkey "$OUT/DonationVerifier_plonk.zkey" "$OUT/verification_key.json"

echo "### 4. Witness generation (shared with Groth16 circuit)"
node build/DonationVerifier_js/generate_witness.js build/DonationVerifier_js/DonationVerifier.wasm build/input.json "$OUT/witness.wtns"

echo "### 5. PLONK proof generation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $SNARKJS plonk prove "$OUT/DonationVerifier_plonk.zkey" "$OUT/witness.wtns" "$OUT/proof.json" "$OUT/public.json" >/dev/null
  E=$(date +%s%N)
  echo "prove_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 6. PLONK proof verification (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $SNARKJS plonk verify "$OUT/verification_key.json" "$OUT/public.json" "$OUT/proof.json"
  E=$(date +%s%N)
  echo "verify_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 7. Export Solidity verifier + calldata (for the on-chain gas test)"
$SNARKJS zkey export solidityverifier "$OUT/DonationVerifier_plonk.zkey" "$OUT/PlonkVerifier.sol"
$SNARKJS zkey export soliditycalldata "$OUT/public.json" "$OUT/proof.json" > "$OUT/calldata.txt"
head -c 200 "$OUT/calldata.txt"; echo

echo "### 8. Artifact sizes"
ls -lh "$OUT/DonationVerifier_plonk.zkey" "$OUT/proof.json" "$OUT/public.json" "$OUT/PlonkVerifier.sol" "$PTAU"
echo "--- public signals ---"
cat "$OUT/public.json"
echo "ALL DONE"
