#!/bin/bash
# Verify a proof locally (off-chain)
# Run INSIDE Docker: docker compose run --rm dev bash packages/circuits/scripts/verify-proof.sh
set -e

cd packages/circuits

echo "Verifying proof..."
snarkjs groth16 verify \
    build/verification_key.json \
    build/public.json \
    build/proof.json

echo "Verification complete."
