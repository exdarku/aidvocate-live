#!/bin/bash
# Generate a ZKP proof (for testing)
# Run INSIDE Docker: docker compose run --rm dev bash packages/circuits/scripts/generate-proof.sh
set -e

cd packages/circuits

if [ ! -f "build/input.json" ]; then
    echo "Error: build/input.json not found. Create it with the proof inputs first."
    exit 1
fi

echo "Generating witness..."
node build/DonationVerifier_js/generate_witness.js \
    build/DonationVerifier_js/DonationVerifier.wasm \
    build/input.json \
    build/witness.wtns

echo "Generating Groth16 proof..."
START=$(date +%s%N)
snarkjs groth16 prove \
    build/DonationVerifier.zkey \
    build/witness.wtns \
    build/proof.json \
    build/public.json
END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))

echo "Proof generated in ${ELAPSED}ms"
echo "Proof: build/proof.json"
echo "Public signals: build/public.json"
