#!/usr/bin/env bash
# =============================================================================
# AidVocate — Smart Contract Security Analysis Runner
# =============================================================================
# Runs Slither static analysis on the contracts directory and produces a
# JSON report with a human-readable summary.
#
# Prerequisites (inside Docker container):
#   pip3 install slither-analyzer
#   solc-select install 0.8.20 && solc-select use 0.8.20
#
# Usage:
#   chmod +x scripts/security-analysis.sh
#   bash scripts/security-analysis.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="$PROJECT_DIR/slither-report.json"

echo "============================================"
echo " AidVocate — Slither Security Analysis"
echo "============================================"
echo ""
echo "Project directory: $PROJECT_DIR"
echo "Report output:     $REPORT_FILE"
echo ""

# Check that slither is installed
if ! command -v slither &> /dev/null; then
    echo "ERROR: slither is not installed."
    echo "Install it with: pip3 install slither-analyzer"
    exit 1
fi

# Check that solc is available
if ! command -v solc &> /dev/null; then
    echo "WARNING: solc not found in PATH. Slither may use solc-select or fail."
fi

echo "Running Slither analysis..."
echo ""

cd "$PROJECT_DIR"

# Run Slither with JSON output; allow non-zero exit (findings cause exit code 1)
set +e
slither . \
    --json "$REPORT_FILE" \
    --filter-paths "node_modules" \
    --solc-remaps "@openzeppelin=node_modules/@openzeppelin" \
    2>&1
SLITHER_EXIT=$?
set -e

echo ""

if [ ! -f "$REPORT_FILE" ]; then
    echo "ERROR: Slither did not produce a report file."
    exit 1
fi

echo "============================================"
echo " Findings Summary"
echo "============================================"
echo ""

# Parse the JSON report and print summary by severity
if command -v python3 &> /dev/null; then
    python3 - "$REPORT_FILE" <<'PYEOF'
import json
import sys

report_path = sys.argv[1]

with open(report_path, "r") as f:
    report = json.load(f)

detectors = report.get("results", {}).get("detectors", [])

if not detectors:
    print("  No findings detected. The contracts appear clean.")
    print("")
    sys.exit(0)

severity_counts = {"High": 0, "Medium": 0, "Low": 0, "Informational": 0, "Optimization": 0}
findings_by_severity = {"High": [], "Medium": [], "Low": [], "Informational": [], "Optimization": []}

for d in detectors:
    impact = d.get("impact", "Informational")
    severity_counts[impact] = severity_counts.get(impact, 0) + 1
    desc = d.get("description", "No description").strip()
    check = d.get("check", "unknown")
    findings_by_severity.setdefault(impact, []).append(f"[{check}] {desc[:120]}")

total = sum(severity_counts.values())
print(f"  Total findings: {total}")
print("")
for sev in ["High", "Medium", "Low", "Informational", "Optimization"]:
    count = severity_counts.get(sev, 0)
    marker = "!!!" if sev == "High" and count > 0 else "   "
    print(f"  {marker} {sev:15s}: {count}")
print("")

for sev in ["High", "Medium", "Low"]:
    items = findings_by_severity.get(sev, [])
    if items:
        print(f"  --- {sev} Severity ---")
        for item in items:
            print(f"    - {item}")
        print("")

PYEOF
elif command -v jq &> /dev/null; then
    echo "  High:          $(jq '[.results.detectors[] | select(.impact=="High")] | length' "$REPORT_FILE")"
    echo "  Medium:        $(jq '[.results.detectors[] | select(.impact=="Medium")] | length' "$REPORT_FILE")"
    echo "  Low:           $(jq '[.results.detectors[] | select(.impact=="Low")] | length' "$REPORT_FILE")"
    echo "  Informational: $(jq '[.results.detectors[] | select(.impact=="Informational")] | length' "$REPORT_FILE")"
    echo "  Optimization:  $(jq '[.results.detectors[] | select(.impact=="Optimization")] | length' "$REPORT_FILE")"
else
    echo "  (Install python3 or jq to see a parsed summary.)"
    echo "  Raw report saved to: $REPORT_FILE"
fi

echo ""
echo "Full report: $REPORT_FILE"
echo "Slither exit code: $SLITHER_EXIT"
echo ""

if [ $SLITHER_EXIT -ne 0 ]; then
    echo "Note: Non-zero exit code typically means findings were detected."
    echo "Review the report for details."
fi

exit 0
