// Measures REAL on-chain gas for the ZoKrates-exported Groth16 verifier,
// completing the verification-gas column of the Phase 0b framework benchmark.
// Uses artifacts from circuits/scripts/docker-zokrates-pipeline.sh.
import { describe, it, before } from "mocha";
import { expect } from "chai";
import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const zokDir = join(__dirname, "..", "..", "circuits", "build", "zokrates");
const zokVerifier = join(__dirname, "..", "contracts", "ZoKratesVerifierFresh.sol");

describe("Phase 0b: Real on-chain ZoKrates (Groth16) verification gas", function () {
  let verifier, proof, inputs;

  before(async function () {
    // Requires the ZoKrates pipeline artifacts; skip gracefully if absent.
    if (!existsSync(join(zokDir, "proof.json")) || !existsSync(zokVerifier)) {
      this.skip();
    }
    const network = await hre.network.connect();
    const { ethers } = network;

    // proof.json: { proof: { a: [x,y], b: [[..],[..]], c: [x,y] }, inputs: [..] }
    const data = JSON.parse(readFileSync(join(zokDir, "proof.json"), "utf8"));
    proof = [data.proof.a, data.proof.b, data.proof.c];
    inputs = data.inputs;

    verifier = await ethers.deployContract("ZoKratesVerifierFresh");
  });

  it("verifies a real ZoKrates proof on-chain and reports gas", async function () {
    const valid = await verifier.verifyTx(proof, inputs);
    console.log(`    ZoKratesVerifier.verifyTx returned: ${valid}`);
    expect(valid).to.equal(true);

    const gas = await verifier.verifyTx.estimateGas(proof, inputs);
    console.log(`    verifyTx (ZoKrates Groth16) gas: ${gas.toString()}`);
    expect(gas).to.be.greaterThan(0n);
  });

  it("rejects a tampered proof (flipped public input)", async function () {
    const badInput = ["0x" + (BigInt(inputs[0]) + 1n).toString(16).padStart(64, "0")];
    const valid = await verifier.verifyTx(proof, badInput);
    expect(valid).to.equal(false);
  });
});
