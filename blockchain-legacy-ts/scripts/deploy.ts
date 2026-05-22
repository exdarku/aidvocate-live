import { ethers, network } from "hardhat";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("              AidVocate Smart Contract Deployment            ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");
  console.log("Network:", network.name);
  console.log("");

  // Deploy AidVocateAudit contract
  console.log("Deploying AidVocateAudit contract...");

  const AidVocateAudit = await ethers.getContractFactory("AidVocateAudit");
  const aidvocateAudit = await AidVocateAudit.deploy();

  await aidvocateAudit.waitForDeployment();

  const contractAddress = await aidvocateAudit.getAddress();
  console.log("AidVocateAudit deployed to:", contractAddress);
  console.log("");

  // Verify deployment
  const owner = await aidvocateAudit.owner();
  console.log("Contract owner:", owner);

  const isDeployerOracle = await aidvocateAudit.authorizedOracles(deployer.address);
  console.log("Deployer is authorized oracle:", isDeployerOracle);
  console.log("");

  // Additional oracles can be authorized here
  // const oracleAddresses = [
  //   "0x...", // Backend oracle
  // ];
  //
  // for (const oracle of oracleAddresses) {
  //   const tx = await aidvocateAudit.authorizeOracle(oracle);
  //   await tx.wait();
  //   console.log("Authorized oracle:", oracle);
  // }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("                    Deployment Complete!                     ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("Contract Address:", contractAddress);
  console.log("");
  console.log("Next steps:");
  console.log("1. Update .env with CONTRACT_ADDRESS=" + contractAddress);
  console.log("2. Verify contract on Polygonscan (if on testnet/mainnet)");
  console.log("3. Authorize additional oracle addresses if needed");
  console.log("");

  // For verification on Polygonscan
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    // Wait for 6 block confirmations
    const deploymentTx = aidvocateAudit.deploymentTransaction();
    if (deploymentTx) {
      await deploymentTx.wait(6);
    }

    console.log("");
    console.log("To verify on Polygonscan, run:");
    console.log(`npx hardhat verify --network ${network.name} ${contractAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
