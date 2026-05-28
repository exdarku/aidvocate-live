#!/bin/bash
# Groth16 trusted setup for DonationVerifier
# Run INSIDE Docker: docker compose run --rm dev bash packages/circuits/scripts/trusted-setup.sh
set -e

cd "$(dirname "$0")/.."
PTAU=ptau/pot14.ptau

if [ ! -f "$PTAU" ]; then
    echo "Downloading Powers of Tau..."
    mkdir -p ptau
    curl -L https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau -o $PTAU
fi

echo "Running Groth16 trusted setup..."

snarkjs groth16 setup build/DonationVerifier.r1cs $PTAU build/DonationVerifier_0000.zkey

snarkjs zkey contribute build/DonationVerifier_0000.zkey build/DonationVerifier.zkey \
    --name="AidVocate Phase 2 contribution" -v -e="aidvocate trusted setup entropy"

snarkjs zkey export verificationkey build/DonationVerifier.zkey build/verification_key.json

echo ""
echo "Trusted setup complete."
echo "Proving key: build/DonationVerifier.zkey"
echo "Verification key: build/verification_key.json"
