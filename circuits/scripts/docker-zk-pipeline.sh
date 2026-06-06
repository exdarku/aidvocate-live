#!/bin/bash
# Full ZK pipeline benchmark, run inside node:20 (linux/amd64) container.
# Mount circuits/ at /src. Produces constraint count + witness/proof/verify timings.
set -e
cd /src
export NODE_OPTIONS=--max-old-space-size=4096
CIRCOM_VER=v2.1.9
SNARKJS="npx --yes snarkjs@0.7.6"

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

echo "### 2. Compile circuit"
mkdir -p build
circom circuits/DonationVerifier.circom --r1cs --wasm --sym -o build/ -l node_modules
echo "--- R1CS info ---"
$SNARKJS r1cs info build/DonationVerifier.r1cs

echo "### 3. Trusted setup (Groth16)"
PTAU=ptau/pot14.ptau
mkdir -p ptau
if [ ! -f "$PTAU" ]; then
  echo "Downloading powers of tau (2^14)..."
  curl -sSL https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau -o "$PTAU"
fi
ls -lh "$PTAU"
$SNARKJS groth16 setup build/DonationVerifier.r1cs "$PTAU" build/DonationVerifier_0000.zkey
echo "test entropy" | $SNARKJS zkey contribute build/DonationVerifier_0000.zkey build/DonationVerifier.zkey --name="bench" -v -e="aidvocate bench entropy" >/dev/null
$SNARKJS zkey export verificationkey build/DonationVerifier.zkey build/verification_key.json
echo "zkey + vk ready"
ls -lh build/DonationVerifier.zkey build/verification_key.json

echo "### 4. Witness generation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  node build/DonationVerifier_js/generate_witness.js build/DonationVerifier_js/DonationVerifier.wasm build/input.json build/witness.wtns
  E=$(date +%s%N)
  echo "witness_run_$i_ms=$(( (E - S) / 1000000 ))"
done

echo "### 5. Proof generation (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $SNARKJS groth16 prove build/DonationVerifier.zkey build/witness.wtns build/proof.json build/public.json >/dev/null
  E=$(date +%s%N)
  echo "prove_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 6. Proof verification (timed, 5 runs)"
for i in 1 2 3 4 5; do
  S=$(date +%s%N)
  $SNARKJS groth16 verify build/verification_key.json build/public.json build/proof.json
  E=$(date +%s%N)
  echo "verify_run_${i}_ms=$(( (E - S) / 1000000 ))"
done

echo "### 7. Artifact sizes"
ls -lh build/proof.json build/public.json build/DonationVerifier_js/DonationVerifier.wasm
echo "--- public signals ---"
cat build/public.json
echo "ALL DONE"
