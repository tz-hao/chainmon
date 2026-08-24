/**
 * Role setup script (Phase 9 / Monad Final) — grants MINTER_ROLE /
 * EVOLVER_ROLE to the backend operator wallet when it differs from the
 * deployer/admin. Read-only when the operator already has both roles.
 * Never logs private keys.
 *
 * Run: npx hardhat run scripts/grant-roles.ts --network localhost
 *      npx hardhat run scripts/grant-roles.ts --network monadTestnet
 *
 * The MonsterNFT address is read from deployments/{network}.json (written by
 * deploy.ts); override with MONSTER_NFT_ADDRESS env if needed.
 * Requires env: OPERATOR_ADDRESS (the backend operator wallet) + network
 * credentials from contracts/.env for real networks.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import { ethers } from "hardhat";

function resolveNftAddress(): string {
  const override = process.env.MONSTER_NFT_ADDRESS;
  if (override) return override;
  const networkName = ethers.provider.network.name;
  const file = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `No deployment record at ${file} — deploy first or set MONSTER_NFT_ADDRESS.`,
    );
  }
  const record = JSON.parse(readFileSync(file, "utf8")) as { MonsterNFT?: string };
  if (!record.MonsterNFT) {
    throw new Error(`Deployment record ${file} has no MonsterNFT address.`);
  }
  return record.MonsterNFT;
}

async function main() {
  const operator = process.env.OPERATOR_ADDRESS;
  if (!operator || !/^0x[0-9a-fA-F]{40}$/.test(operator)) {
    throw new Error("OPERATOR_ADDRESS is required (0x + 40 hex chars).");
  }
  const [deployer] = await ethers.getSigners();
  const nftAddress = resolveNftAddress();
  const nft = await ethers.getContractAt("MonsterNFT", nftAddress);
  const adminRole = await nft.DEFAULT_ADMIN_ROLE();
  const minterRole = await nft.MINTER_ROLE();
  const evolverRole = await nft.EVOLVER_ROLE();

  const hasAdmin = await nft.hasRole(adminRole, deployer.address);
  console.log(`deployer ${deployer.address} admin=${hasAdmin} nft=${nftAddress}`);

  const granted: string[] = [];
  if (!(await nft.hasRole(minterRole, operator))) {
    if (!hasAdmin) throw new Error("Deployer is not admin — cannot grant MINTER_ROLE.");
    await nft.grantRole(minterRole, operator);
    granted.push("MINTER_ROLE");
  }
  if (!(await nft.hasRole(evolverRole, operator))) {
    if (!hasAdmin) throw new Error("Deployer is not admin — cannot grant EVOLVER_ROLE.");
    await nft.grantRole(evolverRole, operator);
    granted.push("EVOLVER_ROLE");
  }

  const minterOk = await nft.hasRole(minterRole, operator);
  const evolverOk = await nft.hasRole(evolverRole, operator);
  console.log(
    `operator ${operator} minter=${minterOk} evolver=${evolverOk} ` +
      (granted.length ? `granted: ${granted.join(", ")}` : "already granted"),
  );
  if (!minterOk || !evolverOk) {
    throw new Error("Role read-back failed — MINTER/EVOLVER not both true.");
  }
}

main().catch((error) => {
  console.error("Role setup failed:", error);
  process.exitCode = 1;
});
