#!/bin/bash
# Export Solidity verifier from circuit
# Run INSIDE Docker: docker compose run --rm dev bash packages/circuits/scripts/export-verifier.sh
set -e

cd "$(dirname "$0")/.."

echo "Exporting Solidity verifier..."
snarkjs zkey export solidityverifier build/DonationVerifier.zkey build/Groth16Verifier.sol

# Copy to contracts package
cp build/Groth16Verifier.sol ../contracts/contracts/Groth16Verifier.sol

echo "Verifier exported to packages/contracts/contracts/Groth16Verifier.sol"
