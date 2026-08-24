import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config();

// Never put private keys into this file — they come from the environment.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      // Monad Testnet requires Prague EVM (Monad EVM is Prague-compatible).
      // OpenZeppelin 5.2 mcopy also needs ≥ Cancun — Prague is a superset.
      evmVersion: "prague",
      optimizer: { enabled: true, runs: 200 },
      metadata: {
        bytecodeHash: "ipfs",
      },
    },
  },
  networks: {
    hardhat: {
      // ephemeral local network used by tests & local deployment
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Public testnet target: Monad Testnet (chainId 10143).
    monadTestnet: {
      url:
        process.env.MONAD_TESTNET_RPC_URL ||
        "https://testnet-rpc.monad.xyz",
      accounts: process.env.MONAD_DEPLOYER_PRIVATE_KEY
        ? [process.env.MONAD_DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 10143,
    },
    // Historical (earlier planned target, kept for reference only).
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      monadTestnet: process.env.MONADSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://api.testnet.monadscan.com/api",
          browserURL: "https://testnet.monadscan.com",
        },
      },
    ],
  },
};

export default config;
