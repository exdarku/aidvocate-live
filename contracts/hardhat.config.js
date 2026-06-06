import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 }
        }
      }
    ],
    overrides: {
      // bb-generated UltraHonk verifier requires >=0.8.27; everything else
      // stays on the evaluated 0.8.20 toolchain.
      "contracts/HonkVerifierFresh.sol": {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 }
        }
      }
    }
  },
  networks: {
    // Standalone local node started by `npx hardhat node` (JSON-RPC on :8545).
    // Deploy to it with `--network localhost` so the contract persists for the
    // backend to talk to.
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.RPC_URL || "http://127.0.0.1:8545"
    },
    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
});
