#!/usr/bin/env python3
"""
AidVocate - Weighted-Sum Model selection and weight-sensitivity analysis.

Reproduces the composite scores in Tables 1 and 2 and the ranking-stability
counts in Table 3 of the CSAI 2026 paper.

Scoring model
-------------
Each criterion is min-max normalised across the candidate set. Cost criteria
(gas, constraints, latency, proof size, setup time) are inverted so that higher
is better. Security maturity is already on [0, 1] and is used directly.

If a metric could not be measured for a candidate (Keccak256 client-side
proving, which aborted), that criterion is dropped for that candidate and the
remaining weights are renormalised, rather than substituting a worst-case value.

Sensitivity sweep
-----------------
All weight vectors in which the four weights are multiples of 0.05, each at
least 0.05, and summing to 1.00. That is C(19,3) = 969 vectors.

Usage:  python3 sensitivity_analysis.py
"""

from collections import Counter

STEP = 0.05
UNITS = 20        # 1.00 / 0.05
MIN_UNITS = 1     # every weight >= 0.05

# --------------------------------------------------------------------------
# Measured data (see Section 2.6 for the environment these were collected in)
# --------------------------------------------------------------------------

# name -> (native on-chain hash gas, R1CS constraints, proof time ms, S_mat)
# proof time None == not measurable (aborted)
HASHES = {
    "Poseidon":  (208_094,     321,    220.5, 0.70),
    "Pedersen":  (26_475_902,  1_614,  233.5, 0.80),
    "MiMC":      (834_210,     3_300,  367.0, 0.50),
    "Keccak256": (22_489,      150_000, None, 1.00),
}
HASH_WEIGHTS = (0.20, 0.30, 0.30, 0.20)   # gas, constraints, proof time, S_mat

# name -> (setup ms, proof ms, proof size B, verify gas) - all cost criteria
FRAMEWORKS = {
    "ZoKrates + Groth16": (76,     100,   849,    234_317),
    "Circom + Groth16":   (8_672,  337,   803,    214_595),
    "Circom + PLONK":     (2_173,  8_801, 2_252,  295_392),
    "Noir + UltraHonk":   (16_167, 152,   14_080, 2_407_000),
}
FW_WEIGHTS = (0.20, 0.30, 0.20, 0.30)     # setup, proof time, size, verify gas


def norm_cost(values, x):
    """Min-max normalise a cost criterion so that higher is better."""
    lo, hi = min(values), max(values)
    return 1.0 if hi == lo else (hi - x) / (hi - lo)


# Ranges are computed over measured values only.
_gas = [v[0] for v in HASHES.values()]
_con = [v[1] for v in HASHES.values()]
_pt = [v[2] for v in HASHES.values() if v[2] is not None]


def hash_score(name, w):
    gas, con, pt, smat = HASHES[name]
    parts = [(norm_cost(_gas, gas), w[0]), (norm_cost(_con, con), w[1])]
    if pt is not None:
        parts.append((norm_cost(_pt, pt), w[2]))     # else: criterion dropped
    parts.append((smat, w[3]))
    return sum(v * k for v, k in parts) / sum(k for _, k in parts)


_cols = list(zip(*FRAMEWORKS.values()))


def fw_score(name, w):
    v = FRAMEWORKS[name]
    return sum(w[i] * norm_cost(_cols[i], v[i]) for i in range(4))


def weight_vectors():
    """All 969 admissible weight vectors."""
    out = []
    for a in range(MIN_UNITS, UNITS - 2 * MIN_UNITS + 1):
        for b in range(MIN_UNITS, UNITS - a - 2 * MIN_UNITS + 1):
            for c in range(MIN_UNITS, UNITS - a - b - MIN_UNITS + 1):
                d = UNITS - a - b - c
                if d >= MIN_UNITS:
                    out.append((a * STEP, b * STEP, c * STEP, d * STEP))
    return out


def sweep(names, scorer, vectors):
    ranks = {n: Counter() for n in names}
    margins = {n: [] for n in names}
    for w in vectors:
        ordered = sorted(((scorer(n, w), n) for n in names), reverse=True)
        for i, (sc, n) in enumerate(ordered):
            ranks[n][i + 1] += 1
        top_sc, top_n = ordered[0]
        margins[top_n].append(top_sc - ordered[1][0])
    return ranks, margins


def report(label, names, scorer, base, vectors):
    print(f"\n=== {label} ===")
    print("Baseline composite scores (weights fixed before testing):")
    for sc, n in sorted(((scorer(n, base), n) for n in names), reverse=True):
        print(f"  {n:22s} {sc:.4f}")

    ranks, margins = sweep(names, scorer, vectors)
    total = len(vectors)
    print(f"\nRanking stability over {total} weight vectors:")
    print(f"  {'Candidate':22s} {'R1':>6s} {'R2':>6s} {'R3':>6s} {'R4':>6s}")
    for n in names:
        r = ranks[n]
        print(f"  {n:22s} {r[1]:6d} {r[2]:6d} {r[3]:6d} {r[4]:6d}")
    for n in names:
        if ranks[n][1]:
            pct = 100.0 * ranks[n][1] / total
            mm = sum(margins[n]) / len(margins[n])
            print(f"  {n}: rank 1 in {ranks[n][1]}/{total} ({pct:.1f}%), "
                  f"mean margin {mm:.4f}, top-2 in {ranks[n][1] + ranks[n][2]}")


def main():
    vectors = weight_vectors()
    assert len(vectors) == 969, len(vectors)

    report("HASH FUNCTIONS", list(HASHES), hash_score, HASH_WEIGHTS, vectors)
    report("FRAMEWORKS", list(FRAMEWORKS), fw_score, FW_WEIGHTS, vectors)

    # Structure of the exceptions to the Poseidon ranking (Section 4.3).
    losses = [w for w in vectors
              if max(hash_score(x, w) for x in HASHES) > hash_score("Poseidon", w) + 1e-12]
    if losses:
        print(f"\nPoseidon is not first in {len(losses)} vectors. "
              f"The smallest combined weight on (native gas + security maturity) "
              f"among those is {min(w[0] + w[3] for w in losses):.2f}.")
        safe = [w for w in vectors if w[0] + w[3] < 0.45 - 1e-9]
        bad = [w for w in safe
               if max(hash_score(x, w) for x in HASHES) > hash_score("Poseidon", w) + 1e-12]
        print(f"Poseidon is first in all {len(safe)} vectors with that combined "
              f"weight below 0.45 ({len(bad)} exceptions).")


if __name__ == "__main__":
    main()
