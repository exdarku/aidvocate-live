#!/usr/bin/env bash
# =============================================================================
# AidVocate — Circuit Security Analysis Runner
# =============================================================================
# Runs Circomspect static analysis on DonationVerifier.circom and saves
# the output to a report file.
#
# Prerequisites (inside Docker container):
#   cargo install circomspect
#   — or install from https://github.com/trailofbits/circomspect
#
# Usage:
#   chmod +x scripts/security-analysis.sh
#   bash scripts/security-analysis.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CIRCUIT_FILE="$PROJECT_DIR/circuits/DonationVerifier.circom"
REPORT_FILE="$PROJECT_DIR/circomspect-report.txt"

echo "============================================"
echo " AidVocate — Circomspect Circuit Analysis"
echo "============================================"
echo ""
echo "Project directory: $PROJECT_DIR"
echo "Circuit file:      $CIRCUIT_FILE"
echo "Report output:     $REPORT_FILE"
echo ""

# Check that circomspect is installed
if ! command -v circomspect &> /dev/null; then
    echo "ERROR: circomspect is not installed."
    echo "Install it with: cargo install circomspect"
    echo "Or visit: https://github.com/trailofbits/circomspect"
    exit 1
fi

# Check that the circuit file exists
if [ ! -f "$CIRCUIT_FILE" ]; then
    echo "ERROR: Circuit file not found: $CIRCUIT_FILE"
    exit 1
fi

echo "Running Circomspect analysis..."
echo ""

cd "$PROJECT_DIR"

# Run Circomspect and capture output; allow non-zero exit (findings cause exit code 1)
set +e
circomspect "$CIRCUIT_FILE" 2>&1 | tee "$REPORT_FILE"
CIRCOMSPECT_EXIT=${PIPESTATUS[0]}
set -e

echo ""
echo "============================================"
echo " Analysis Complete"
echo "============================================"
echo ""
echo "Report saved to: $REPORT_FILE"
echo "Circomspect exit code: $CIRCOMSPECT_EXIT"
echo ""

# Count findings in the report
if [ -f "$REPORT_FILE" ]; then
    WARNING_COUNT=$(grep -ci "warning" "$REPORT_FILE" 2>/dev/null || echo "0")
    ERROR_COUNT=$(grep -ci "error" "$REPORT_FILE" 2>/dev/null || echo "0")
    echo "  Warnings: $WARNING_COUNT"
    echo "  Errors:   $ERROR_COUNT"
    echo ""

    if [ "$WARNING_COUNT" = "0" ] && [ "$ERROR_COUNT" = "0" ]; then
        echo "  No issues detected. The circuit appears clean."
    else
        echo "  Review the report for details."
    fi
fi

exit 0
