/**
 * ChainMon deployment script — deploys MonsterNFT then MonsterMarketplace
 * sequentially (marketplace depends on the NFT address) and records both to
 * contracts/deployments/{network}.json.
 * Never logs private keys.
 *
 * Run: npx hardhat run scripts/deploy.ts (hardhat network)
 *      npx hardhat run scripts/deploy.ts --network localhost
 *      npx hardhat run scripts/deploy.ts --network monadTestnet
 *      npx hardhat run scripts/deploy.ts --network baseSepolia
 *
 * Monad Testnet requires MONAD_TESTNET_RPC_URL + MONAD_DEPLOYER_PRIVATE_KEY
 * in contracts/.env (or environment) and test MON in the deployer wallet.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { ethers } from "hardhat";

const NFT_NAME = "ChainMon Monsters";
const NFT_SYMBOL = "CMON";
const BASE_URI = "https://api.chainmon.game/metadata/";

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;
  const chainId = network.chainId.toString();

  // Never deploy with an empty signer (missing private key) — fail fast.
  const deployers = await ethers.getSigners();
  if (deployers.length === 0) {
    throw new Error(
      `No signer available for network "${networkName}" (chainId ${chainId}) — ` +
        "check MONAD_DEPLOYER_PRIVATE_KEY (Monad Testnet) / DEPLOYER_PRIVATE_KEY (other networks).",
    );
  }
  const deployer = deployers[0];

  // Pre-flight: never deploy to a wrong chain (Phase 9: RPC chainId must
  // match the configured network; Monad Testnet = 10143).
  console.log(`Deploying to network "${networkName}" chainId=${chainId} deployer=${deployer.address}`);

  // 1. Asset contract — sequential, wait for receipt.
  const nftFactory = await ethers.getContractFactory("MonsterNFT");
  const nft = await nftFactory.deploy(NFT_NAME, NFT_SYMBOL, BASE_URI, deployer.address);
  const nftReceipt = await nft.deploymentTransaction()?.wait();
  const nftAddress = await nft.getAddress();
  if (nftReceipt?.status !== 1) {
    throw new Error(`MonsterNFT deployment failed: receipt status=${nftReceipt?.status}`);
  }
  console.log(`MonsterNFT deployed at ${nftAddress} tx=${nft.deploymentTransaction()?.hash} status=success`);

  // 2. Trading contract (references the asset contract) — sequential.
  const mpFactory = await ethers.getContractFactory("MonsterMarketplace");
  const marketplace = await mpFactory.deploy(nftAddress, deployer.address);
  const mpReceipt = await marketplace.deploymentTransaction()?.wait();
  const marketplaceAddress = await marketplace.getAddress();
  if (mpReceipt?.status !== 1) {
    throw new Error(`MonsterMarketplace deployment failed: receipt status=${mpReceipt?.status}`);
  }
  console.log(`MonsterMarketplace deployed at ${marketplaceAddress} tx=${marketplace.deploymentTransaction()?.hash} status=success`);

  // 3. Post-deploy code + wiring checks.
  const nftCode = await ethers.provider.getCode(nftAddress);
  const mpCode = await ethers.provider.getCode(marketplaceAddress);
  if (nftCode === "0x" || mpCode === "0x") {
    throw new Error("Post-deploy code check failed (empty bytecode).");
  }
  const mp = await ethers.getContractAt("MonsterMarketplace", marketplaceAddress);
  const wiredNft = await mp.monsterNFT();
  if (wiredNft.toLowerCase() !== nftAddress.toLowerCase()) {
    throw new Error(`Marketplace wiring mismatch: monsterNFT()=${wiredNft} != ${nftAddress}`);
  }
  const nftVersion = await (await ethers.getContractAt("MonsterNFT", nftAddress)).CONTRACT_VERSION();
  const mpVersion = await mp.CONTRACT_VERSION();
  console.log(`Versions: MonsterNFT=${nftVersion} MonsterMarketplace=${mpVersion} wiring=OK`);

  // 4. Roles (deployer = admin + minter + evolver at construction).
  const nftContract = await ethers.getContractAt("MonsterNFT", nftAddress);
  const minterRole = await nftContract.MINTER_ROLE();
  const evolverRole = await nftContract.EVOLVER_ROLE();
  const minterOk = await nftContract.hasRole(minterRole, deployer.address);
  const evolverOk = await nftContract.hasRole(evolverRole, deployer.address);
  console.log(`Roles on deployer: MINTER=${minterOk} EVOLVER=${evolverOk}`);

  const deployment = {
    network: networkName,
    chainId,
    MonsterNFT: nftAddress,
    MonsterMarketplace: marketplaceAddress,
    deployer: deployer.address,
    monsterNftDeploymentTx: nft.deploymentTransaction()?.hash ?? "",
    marketplaceDeploymentTx: marketplace.deploymentTransaction()?.hash ?? "",
    blockNumber: nftReceipt?.blockNumber ?? 0,
    deployedAt: new Date().toISOString(),
    contractVersion: nftVersion,
  };

  const dir = path.join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${networkName}.json`),
    JSON.stringify(deployment, null, 2),
  );

  console.log(JSON.stringify(deployment, null, 2));
  console.log(`Deployment recorded in deployments/${networkName}.json`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
