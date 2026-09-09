# AidVocate

A privacy-preserving donation verification system on blockchain. Donors can prove they made a charitable contribution to any third party (employer, tax authority, family) **without revealing the donation amount, recipient NGO, or their identity**.

Built as a CS thesis project at Mapua Malayan Colleges Mindanao.

---

## How It Works

Think of it like this: **AidVocate lets someone prove they donated to charity without revealing how much, to whom, or who they are.**

### The Problem

Say your employer offers a tax benefit if you donate to charity. Right now you'd show them a receipt — but that receipt reveals everything: the amount, the NGO, your name. What if you could just prove "yes, I donated" without showing any of those details?

That's what AidVocate does. It combines three cryptographic techniques to make this possible.

---

### The 3 Key Concepts

#### 1. Cryptographic Commitment (the "sealed envelope")

When you make a donation, the system takes your details:
- **Who** you are (donorId)
- **How much** (amount)
- **To whom** (ngoId)
- **When** (timestamp)
- A **random secret** (salt)

...and runs them through a special hash function called **Poseidon**:

```
commitment = Poseidon(donorId, amount, ngoId, timestamp, salt)
```

This produces a single number (the "commitment"). It's like putting your donation receipt in a sealed envelope — anyone can see the envelope exists, but nobody can open it to see what's inside. And you can't change what's inside without getting a different envelope.

#### 2. Merkle Tree (the "tournament bracket")

Imagine you have 1,000 donations. Storing each one on the blockchain would cost a fortune in gas fees. Instead, we use a **Merkle tree** — think of it like a tournament bracket:

```
         Root Hash          <-- This ONE hash goes on-chain
        /          \
     Hash AB      Hash CD
      /  \         /  \
    A     B      C     D   <-- These are your commitment hashes
```

You pair up commitments, hash each pair, pair those up, hash again... until you get ONE root hash. That single root represents ALL 1,000 donations.

**Only the root goes on the blockchain** — saving 99.9% in gas costs (our scalability tests prove this: 22,000 gas vs 22,000,000 gas for 1,000 donations).

#### 3. Zero-Knowledge Proof (the "locked room magic trick")

Here's the magic part. You want to prove your donation is in that Merkle tree, but without revealing which donation is yours, what the amount was, or which NGO received it.

A **zero-knowledge proof** works like this analogy:

> Imagine a cave with two paths that connect at the back through a locked door. You want to prove you know the password — but you don't want to tell anyone what it is. So the verifier stands at the entrance, you go inside, and they shout "come out the left path!" and you do. You repeat this many times. If you always come out whichever side they pick, they're convinced you know the password — but they never learned what it was.

In our system:
1. Your browser loads the ZK circuit (a math program)
2. You feed in your private data (donation details + your position in the Merkle tree)
3. The circuit generates a **proof** — a small piece of data (~256 bytes) that mathematically says "I know a valid donation in this tree"
4. Anyone can verify the proof against the Merkle root on-chain — but the proof reveals **nothing** about your donation

---

### The Full Flow

```
DONOR                          BACKEND                      BLOCKCHAIN
  |                               |                              |
  |  1. "I donate P500 to NGO X" |                              |
  |  ---------------------------> |                              |
  |                               |  2. Computes commitment:     |
  |                               |     Poseidon(donor, 500,     |
  |                               |       ngo, time, salt)       |
  |                               |     Stores in SQLite DB      |
  |  3. Gets receipt with         |                              |
  |     commitment hash + salt    |                              |
  |  <--------------------------- |                              |
  |                               |                              |
  |        ... more donations ... |                              |
  |                               |                              |
  |                               |  4. NGO creates batch:       |
  |                               |     Builds Merkle tree from  |
  |                               |     all pending commitments  |
  |                               |                              |
  |                               |  5. Submits root on-chain    |
  |                               |  --------------------------> |
  |                               |                              | storeMerkleRoot(root)
  |                               |                              |
  |  ============ LATER, VERIFICATION ============               |
  |                               |                              |
  |  6. "I want to prove I        |                              |
  |      donated"                 |                              |
  |  ---------------------------> |                              |
  |                               |  7. Returns Merkle proof:    |
  |  8. Gets: my donation data +  |     sibling hashes + path    |
  |     path through the tree     |                              |
  |  <--------------------------- |                              |
  |                               |                              |
  |  9. Browser generates ZK      |                              |
  |     proof locally (snarkjs)   |                              |
  |     Private data NEVER leaves |                              |
  |     my device!                |                              |
  |                               |                              |
  | 10. Sends proof to verify     |                              |
  |  ---------------------------> |                              |
  |                               | 11. Calls on-chain verifier  |
  |                               |  --------------------------> |
  |                               |                              | verifyDonation(proof)
  |                               |                              | Returns: true
  |                               |  <-------------------------- |
  | 12. "Donation verified!"      |                              |
  |  <--------------------------- |                              |
```

**The key insight:** At step 9, the proof is generated **in your browser**. Your private donation data never goes to the blockchain or any server during verification. The blockchain only sees the proof (which reveals nothing) and confirms it's valid.

---

## Project Structure

```
aidvocate/
├── packages/
│   ├── benchmark/      # Phase 0: hash function + ZKP framework comparison
│   ├── circuits/       # Circom ZKP circuits + Groth16 trusted setup
│   ├── contracts/      # Hardhat + Solidity smart contracts
│   ├── backend/        # Express + SQLite REST API
│   └── frontend/       # Vite + React + TypeScript SPA
├── docs/
│   ├── plans/          # Design doc + implementation plan
│   ├── guide/          # Developer guide + setup instructions
│   ├── overview/       # Simplified overview for non-technical readers
│   └── security/       # Security analysis report
├── Dockerfile          # Dev environment with all ZKP tools
└── docker-compose.yml  # One command to start everything
```

### How the Code Maps to the Concepts

| Concept | Code | What it does |
|---|---|---|
| Make a donation | `backend/src/routes/donations.js` | Saves donation + generates commitment hash |
| Poseidon hash | `backend/src/services/merkle.js` | Hashes 5 inputs into one commitment |
| Build Merkle tree | `backend/src/routes/batches.js` | Groups commitments into a tree, computes root |
| Store root on-chain | `contracts/AidVocate.sol` `storeMerkleRoot()` | Saves the single root hash to Ethereum |
| Generate ZK proof | `frontend/src/services/zkp.ts` | Runs snarkjs in browser with your private data |
| Verify proof on-chain | `contracts/AidVocate.sol` `verifyDonation()` | Checks the math proof against the stored root |
| The ZK circuit (the math) | `circuits/DonationVerifier.circom` | Defines exactly what the proof proves |
| The UI | `frontend/src/pages/*.tsx` | Register, donate, view history, verify |

---

## Phase 0: Why We Benchmarked

Before building the real system, we compared different options to justify our choices (this is the academic rigor the thesis requires):

**Hash functions compared** (in `packages/benchmark/`):
- **Keccak256** — Native to Ethereum but extremely expensive in ZK circuits (~150,000 constraints)
- **Poseidon** — Designed for ZK circuits, very cheap (~300 constraints). **Winner.**
- **MiMC** — Moderate ZK cost (~1,000+ constraints)
- **Pedersen** — Has a unique additive homomorphic property but moderate ZK cost

**ZKP frameworks compared**:
- **Circom + Groth16** — Best browser support (WASM), smallest proofs (~256 bytes). **Winner.**
- **Circom + PLONK** — Universal trusted setup but larger proofs (~2-10 KB)
- **ZoKrates** — Python-like syntax, limited browser support
- **Noir** — Rust-like syntax by Aztec Labs, newer ecosystem

---

## Getting Started

Everything runs inside Docker — nothing gets installed on your machine except Docker Desktop.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/exdarku/aidvocate-live.git && cd aidvocate-live

# 2. Build the Docker image (installs Circom, snarkjs, ZoKrates, Noir, Slither, etc.)
docker compose build

# 3. Enter the container
docker compose run --rm dev bash

# 4. Install dependencies
pnpm install
```

### Running Things

All commands below run **inside the Docker container**.

```bash
# Run smart contract tests (20 tests)
cd packages/contracts && npx hardhat test

# Start the backend API (port 3001)
cd packages/backend && node src/index.js

# Start the frontend dev server (port 5173)
cd packages/frontend && npx vite --host

# Start a local Hardhat blockchain node (port 8545)
cd packages/contracts && npx hardhat node

# Deploy contracts to local network
cd packages/contracts && npx hardhat run scripts/deploy.js

# Run Phase 0 hash benchmarks
cd packages/benchmark && npx hardhat test

# Run security analysis
cd packages/contracts && bash scripts/security-analysis.sh
cd packages/circuits && bash scripts/security-analysis.sh
```

### Full End-to-End Workflow

```bash
# 1. Compile the ZK circuit
cd packages/circuits && bash scripts/compile-circuit.sh

# 2. Run trusted setup (generates proving + verification keys)
bash scripts/trusted-setup.sh

# 3. Export the Solidity verifier to contracts package
bash scripts/export-verifier.sh

# 4. Start a local blockchain
cd packages/contracts && npx hardhat node &

# 5. Deploy contracts
npx hardhat run scripts/deploy.js

# 6. Start the backend (set CONTRACT_ADDRESS from deploy output)
cd packages/backend && CONTRACT_ADDRESS=0x... node src/index.js &

# 7. Start the frontend
cd packages/frontend && npx vite --host
```

Then open http://localhost:5173 in your browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Ethereum (Hardhat local + Polygon Amoy testnet) |
| Smart Contracts | Solidity ^0.8.20, Hardhat 3, ethers.js v6 |
| ZKP Circuits | Circom 2.x + snarkjs (Groth16) |
| Hash Function | Poseidon (from circomlib) |
| Backend | Node.js, Express, SQLite (better-sqlite3) |
| Frontend | Vite + React 18 + TypeScript |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Package Manager | pnpm workspaces |
| Dev Environment | Docker |

---

## Repository

    https://github.com/exdarku/aidvocate-live

## Documentation

- **[Evaluation Report](docs/EVALUATION.md)** — Full security and functional evaluation, including open findings (F1–F8) and their recommendations
- **[Testing Explanation](docs/TESTING-EXPLANATION.md)** — Technical walkthrough mapping every test and script to the claims it supports
- **[ZK Toolchain Benchmark Design](docs/superpowers/specs/2026-06-04-zk-toolchain-benchmark-design.md)** — Methodology for the hash-function and framework benchmarks
- **[Paper Alignment Design](docs/superpowers/specs/2026-06-06-paper-alignment-design.md)** — How the implementation maps to the reported results

## Trusted setup ceremony

The Groth16 Phase 2 setup transcript is published in
**[ceremony/transcript.md](ceremony/transcript.md)**, with the raw
`snarkjs zkey verify` output in `ceremony/zkey_verify_output.txt`.

The Phase 2 setup has **one contribution** and **no public randomness beacon**, and
its entropy string is hardcoded in `circuits/scripts/trusted-setup.sh`. This is a
known limitation recorded as finding F1 in the evaluation report: the setup is
suitable for development, benchmarking, and testnet use, but a production
deployment requires a genuine multi-party ceremony. Phase 1 uses the public
perpetual Powers of Tau (`powersOfTau28_hez_final_14`).

## Reproducing the selection analysis (Tables 1, 2 and 3)

`analysis/sensitivity_analysis.py` reproduces the Weighted-Sum Model composite
scores and the weight-sensitivity sweep reported in the paper:

- **Table 1** — hash-function composite scores (Poseidon, Pedersen, MiMC, Keccak256)
- **Table 2** — framework composite scores (ZoKrates+Groth16, Circom+Groth16,
  Circom+PLONK, Noir+UltraHonk)
- **Table 3** — ranking stability over all 969 admissible weight vectors in which
  the four weights are multiples of 0.05, each at least 0.05, and sum to 1.00

```bash
python analysis/sensitivity_analysis.py
```

The script applies the scoring model to the measured values recorded in the
benchmark documents; it performs no measurement itself, so it is deterministic and
needs only the Python standard library. Captured output is in
`analysis/sensitivity_output.txt`.