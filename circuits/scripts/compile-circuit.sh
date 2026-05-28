#!/bin/bash
# Compile DonationVerifier circuit
# Run INSIDE Docker: docker compose run --rm dev bash packages/circuits/scripts/compile-circuit.sh
set -e

cd "$(dirname "$0")/.."
mkdir -p build

echo "Compiling DonationVerifier circuit..."
circom circuits/DonationVerifier.circom \
    --r1cs \
    --wasm \
    --sym \
    -o build/ \
    -l node_modules

echo "Circuit compiled successfully."
snarkjs r1cs info build/DonationVerifier.r1cs
echo ""
echo "WASM: build/DonationVerifier_js/DonationVerifier.wasm"
echo "R1CS: build/DonationVerifier.r1cs"
