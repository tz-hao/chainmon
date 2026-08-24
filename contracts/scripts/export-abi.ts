/**
 * Exports the compiled MonsterNFT and MonsterMarketplace ABIs to
 * contracts/abis/. Run after `hardhat compile`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const CONTRACTS = [
  { name: "MonsterNFT", file: "MonsterNFT.sol" },
  { name: "MonsterMarketplace", file: "MonsterMarketplace.sol" },
];

for (const { name, file } of CONTRACTS) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    file,
    `${name}.json`,
  );
  const outPath = path.join(__dirname, "..", "abis", `${name}.json`);

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    abi: unknown[];
  };

  const output = {
    contractName: name,
    abi: artifact.abi,
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`ABI exported to ${outPath} (${artifact.abi.length} ABI entries)`);
}
