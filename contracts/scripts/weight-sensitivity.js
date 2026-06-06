// Weight-sensitivity analysis for the multi-criteria rankings in the
// evaluation (hash function selection and ZKP framework selection).
//
// Methodology (matches the paper, section 3.6.1): each metric is min-max
// normalized to [0,1] with the best performer at 1 (direction-aware); the
// composite is the weighted sum. If a candidate is missing a metric, its
// composite is computed over the remaining criteria with weights renormalized
// to sum to 1 (the treatment used for Keccak256's unmeasured proof time).
//
// Analyses:
//   1. Baseline ranking with the paper's weights.
//   2. Exhaustive sweep over all weight combinations on a 0.05 grid
//      (each weight >= 0.05, summing to 1): how often does the baseline
//      winner stay #1? Who overtakes, and under which weights?
//   3. One-at-a-time perturbation: each weight +/-0.10, others scaled
//      proportionally.
//   4. Flip threshold: for each metric, the minimum weight on that single
//      metric (rest split proportionally to the baseline) at which the
//      winner changes.
//
// Run: node scripts/weight-sensitivity.js
//
// Data sources: Table 17 (hash benchmark) and the cross-toolchain benchmark
// measured 2026-06-06 (docs/EVALUATION.md section 3.5). The paper's original
// Table 18 timings are included as an alternative dataset to show the
// conclusion is robust to which measurement run is used.

const DATASETS = {
  hash: {
    title: "Hash function selection (Table 17)",
    // direction: -1 = lower is better, +1 = higher is better
    metrics: [
      { key: "gas", label: "On-chain gas", dir: -1, weight: 0.2 },
      { key: "constraints", label: "R1CS constraints", dir: -1, weight: 0.3 },
      { key: "proofTime", label: "Proof time (ms)", dir: -1, weight: 0.3 },
      { key: "security", label: "Security maturity", dir: +1, weight: 0.2, preNormalized: true },
    ],
    candidates: [
      { name: "Poseidon", gas: 208094, constraints: 321, proofTime: 220.5, security: 0.7 },
      { name: "Pedersen", gas: 26475902, constraints: 1614, proofTime: 233.5, security: 0.8 },
      { name: "MiMC", gas: 834210, constraints: 3300, proofTime: 367, security: 0.5 },
      { name: "Keccak256", gas: 22489, constraints: 150000, proofTime: null, security: 1.0 },
    ],
  },
  "zkp-measured": {
    title: "ZKP framework selection (measured 2026-06-06, all gas on-chain)",
    metrics: [
      { key: "proofTime", label: "Proof time (ms)", dir: -1, weight: 0.3 },
      { key: "proofSize", label: "Proof size (B)", dir: -1, weight: 0.2 },
      { key: "verifyGas", label: "Verify gas", dir: -1, weight: 0.3 },
      { key: "setupTime", label: "Setup time (ms)", dir: -1, weight: 0.2 },
    ],
    // Notes: Circom proof time is QEMU-emulated (upper bound); Noir setup is
    // 0 (UltraHonk needs no circuit-specific setup); Circom+Groth16 setup is
    // the paper's one-off ceremony figure (not re-timed).
    candidates: [
      { name: "Circom+Groth16", proofTime: 3600, proofSize: 807, verifyGas: 218720, setupTime: 8672 },
      { name: "ZoKrates+Groth16", proofTime: 238, proofSize: 849, verifyGas: 234529, setupTime: 206 },
      { name: "Noir+UltraHonk", proofTime: 170, proofSize: 14080, verifyGas: 2385342, setupTime: 0 },
      { name: "Circom+PLONK", proofTime: 21147, proofSize: 2245, verifyGas: 293366, setupTime: 3776 },
    ],
  },
  "zkp-paper": {
    title: "ZKP framework selection (paper Table 18 timings, gas filled from measured)",
    metrics: [
      { key: "proofTime", label: "Proof time (ms)", dir: -1, weight: 0.3 },
      { key: "proofSize", label: "Proof size (B)", dir: -1, weight: 0.2 },
      { key: "verifyGas", label: "Verify gas", dir: -1, weight: 0.3 },
      { key: "setupTime", label: "Setup time (ms)", dir: -1, weight: 0.2 },
    ],
    candidates: [
      { name: "Circom+Groth16", proofTime: 337, proofSize: 807, verifyGas: 218720, setupTime: 8672 },
      { name: "ZoKrates+Groth16", proofTime: 100, proofSize: 849, verifyGas: 234529, setupTime: 76 },
      { name: "Noir+UltraHonk", proofTime: 152, proofSize: 14080, verifyGas: 2385342, setupTime: 16167 },
      { name: "Circom+PLONK", proofTime: 8801, proofSize: 2245, verifyGas: 293366, setupTime: 2173 },
    ],
  },
};

// ---------------------------------------------------------------------------

function normalize(candidates, metrics) {
  const norm = {};
  for (const m of metrics) {
    const values = candidates.map((c) => c[m.key]).filter((v) => v !== null && v !== undefined);
    const min = Math.min(...values);
    const max = Math.max(...values);
    norm[m.key] = (v) => {
      if (v === null || v === undefined) return null;
      if (m.preNormalized) return v; // already a 0..1 score (e.g. security)
      if (max === min) return 1;
      return m.dir === -1 ? (max - v) / (max - min) : (v - min) / (max - min);
    };
  }
  return norm;
}

function composite(candidate, metrics, weights, norm) {
  let score = 0;
  let usedWeight = 0;
  for (const m of metrics) {
    const n = norm[m.key](candidate[m.key]);
    if (n === null) continue; // missing metric: renormalize below
    score += weights[m.key] * n;
    usedWeight += weights[m.key];
  }
  return usedWeight > 0 ? score / usedWeight : 0;
}

function rank(dataset, weights) {
  const norm = normalize(dataset.candidates, dataset.metrics);
  return dataset.candidates
    .map((c) => ({ name: c.name, score: composite(c, dataset.metrics, weights, norm) }))
    .sort((a, b) => b.score - a.score);
}

function baselineWeights(dataset) {
  return Object.fromEntries(dataset.metrics.map((m) => [m.key, m.weight]));
}

// All weight vectors on a `step` grid where each weight >= step and sums to 1.
function* weightGrid(keys, step = 0.05) {
  const n = Math.round(1 / step);
  function* recurse(idx, remaining, acc) {
    if (idx === keys.length - 1) {
      if (remaining >= 1) yield { ...acc, [keys[idx]]: remaining * step };
      return;
    }
    for (let units = 1; units <= remaining - (keys.length - 1 - idx); units++) {
      yield* recurse(idx + 1, remaining - units, { ...acc, [keys[idx]]: units * step });
    }
  }
  yield* recurse(0, n, {});
}

function fmtWeights(w) {
  return Object.entries(w).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" ");
}

// ---------------------------------------------------------------------------

for (const [id, dataset] of Object.entries(DATASETS)) {
  const keys = dataset.metrics.map((m) => m.key);
  const base = baselineWeights(dataset);

  console.log("=".repeat(74));
  console.log(`${dataset.title}  [${id}]`);
  console.log("=".repeat(74));

  // 1. Baseline
  const baseRank = rank(dataset, base);
  console.log(`\n1) Baseline ranking (weights: ${fmtWeights(base)})`);
  baseRank.forEach((r, i) => console.log(`   ${i + 1}. ${r.name.padEnd(20)} ${r.score.toFixed(4)}`));
  const winner = baseRank[0].name;

  // 2. Exhaustive sweep
  let total = 0;
  const winCounts = {};
  const flipExamples = {};
  for (const w of weightGrid(keys, 0.05)) {
    total++;
    const top = rank(dataset, w)[0].name;
    winCounts[top] = (winCounts[top] || 0) + 1;
    if (top !== winner && !flipExamples[top]) flipExamples[top] = w;
  }
  console.log(`\n2) Exhaustive sweep: ${total} weight combinations (0.05 grid, each >= 0.05)`);
  for (const [name, count] of Object.entries(winCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${name.padEnd(20)} ranks #1 in ${count}/${total} (${((count / total) * 100).toFixed(1)}%)`);
  }
  for (const [name, w] of Object.entries(flipExamples)) {
    console.log(`   e.g. ${name} overtakes at: ${fmtWeights(w)}`);
  }

  // 3. One-at-a-time perturbation (+/- 0.10, others scaled proportionally)
  console.log(`\n3) One-at-a-time perturbation (+/-0.10): does #1 change?`);
  for (const key of keys) {
    for (const delta of [-0.1, 0.1]) {
      const wNew = { ...base, [key]: Math.max(0.01, base[key] + delta) };
      const rest = keys.filter((k) => k !== key);
      const restBase = rest.reduce((s, k) => s + base[k], 0);
      const restTarget = 1 - wNew[key];
      rest.forEach((k) => (wNew[k] = (base[k] / restBase) * restTarget));
      const top = rank(dataset, wNew)[0];
      const mark = top.name === winner ? "stable" : `FLIPS -> ${top.name}`;
      console.log(`   ${key} ${delta > 0 ? "+" : ""}${delta.toFixed(2)}: #1 = ${top.name.padEnd(20)} [${mark}]`);
    }
  }

  // 4. Flip thresholds: raise one metric's weight until the winner changes
  console.log(`\n4) Flip thresholds (single metric weight at which #1 changes):`);
  for (const key of keys) {
    let flippedAt = null;
    let flippedTo = null;
    for (let wk = 0.05; wk <= 0.95001; wk += 0.01) {
      const wNew = { [key]: wk };
      const rest = keys.filter((k) => k !== key);
      const restBase = rest.reduce((s, k) => s + base[k], 0);
      rest.forEach((k) => (wNew[k] = (base[k] / restBase) * (1 - wk)));
      const top = rank(dataset, wNew)[0];
      if (top.name !== winner) {
        flippedAt = wk;
        flippedTo = top.name;
        break;
      }
    }
    console.log(
      flippedAt === null
        ? `   ${key}: never flips (winner robust across full range)`
        : `   ${key}: flips to ${flippedTo} at weight >= ${flippedAt.toFixed(2)}`
    );
  }
  console.log();
}
