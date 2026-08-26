# ChainMon — Documentation

A Web3 monster-collecting RPG deployed on **Monad Testnet**, combining persistent off-chain progression with ERC-721 ownership, on-chain evolution, and a non-custodial MON marketplace.

Core loop: **Explore → Encounter → Capture → Collect → Team → 3v3 Battle → Level up → Evolve → NFT → Marketplace**

> ⚠️ Monad Testnet is a testing environment — contracts/assets are not
> production mainnet assets; testnets can reset or upgrade.

## Networks

| Network | Chain ID | Currency | RPC | Explorer |
| --- | --- | --- | --- | --- |
| Monad Testnet (public target) | 10143 | MON | https://testnet-rpc.monad.xyz | https://testnet.monadscan.com |
| Hardhat localhost (dev/CI) | 31337 | ETH | http://127.0.0.1:8545 | — |

## Monorepo layout

```
chainmon/
  apps/web          Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS
  packages/game-engine   Pure game logic (battle / capture / damage / exp / evolution)
  packages/monster-data  Monster species catalogue (28 species, 48 skills including 8 Web3 / 32 Knowledge skills, regions)
  packages/shared        Shared domain types & constants
  prisma/           PostgreSQL schema (Prisma) + idempotent seed
  contracts/        Solidity (MonsterNFT.sol, MonsterMarketplace.sol) + Hardhat
  scripts/          audit-state.ts (read-only consistency audit), validate-env.ts, browser-e2e.ts
  docs/             This documentation
```

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project scaffold, DB schema, base UI | ✅ Done |
| 2 | Monster data model, 28 species, collection UI | ✅ Done |
| 3 | Explore / Encounter / Capture loop | ✅ Done |
| 4 | 3v3 turn-based battle engine | ✅ Done |
| 5 | Progression: EXP, levels, gold, skill unlock, evolution | ✅ Done |
| 6 | MonsterNFT.sol (ERC-721 identity, roles, events, tests, ABI) | ✅ Done |
| 7 | Wallet verify, NFT claim (mint state machine), on-chain reads, minted evolution sync, metadata API | ✅ Done |
| 8 | Marketplace (list / buy / cancel), ownership sync, gameplay lock | ✅ Done |
| 9 | Production readiness: real PostgreSQL, integration tests, E2E, audit, docs | ✅ Done |
| Final | Monad Testnet deployment & acceptance | ✅ Done |

**ChainMon Phase-based development is complete. No Phase 10 is planned.**

## Local development

```bash
npm install
docker compose up -d                 # PostgreSQL 16 (chainmon/chainmon_local_dev)
Copy-Item .env.example .env          # root: DATABASE_URL + CHAINMON_DATA_MODE
Copy-Item apps/web/.env.example apps/web/.env.local
npm run db:generate
npm run db:push
npm run db:seed                      # idempotent (run twice to verify)
cd contracts && npx hardhat node     # terminal 1
npx hardhat run scripts/deploy.ts --network localhost
cd .. && npm run dev                 # terminal 2 — http://localhost:3000
```

Monad Testnet deployment: `npm run monad:preflight` →
`npm run contracts:deploy:monad` → configure web env (chainId 10143).
See `deployment.md` for production steps and `demo-script.md` for the demo.

See `deployment.md` for production steps and `demo-script.md` for the demo.

## Quality gates

```bash
npm test                  # app unit tests
npm run test:contracts    # Hardhat contract tests
npm run lint
npm run build             # production build (includes typecheck)
npx tsx scripts/validate-env.ts --check-rpc
```

Env-gated suites (run explicitly when services are up):

```bash
RUN_CHAIN_INTEGRATION=1 npx vitest run apps/web/lib/web3/__tests__/chain-integration.test.ts apps/web/lib/web3/__tests__/chain-marketplace-integration.test.ts
RUN_DATABASE_INTEGRATION=1 npx vitest run apps/web/lib/data/__tests__/database-integration.test.ts
RUN_E2E=1 RUN_CHAIN_INTEGRATION=1 npx vitest run apps/web/lib/data/__tests__/e2e-full-flow.test.ts apps/web/lib/data/__tests__/e2e-evolution.test.ts
RUN_MONAD_TESTNET_INTEGRATION=1 npx vitest run apps/web/lib/web3/__tests__/monad-testnet-integration.test.ts
```

## Game rules (design reference)

- Elements: Fire > Nature > Water > Fire, Electric > Water.
- Multiplier: 1.5x (advantage) / 0.75x (disadvantage) / 1.0x (neutral).
- Damage: `damage = (skillPower * attack / defense) * elementMultiplier * randomFactor(0.9~1.1)`.
- EXP required per level: `level * level * 100`.
- Capture rate: `baseRate * hpModifier * ballModifier` (random roll).
- On-chain (ERC-721): ownership, species, generation, DNA hash, rarity, evolution stage, marketplace.
- Off-chain: EXP, level, stats, skills, battle state, gold, inventory.

## Trust model

Trusted Game Operator Model — the backend holds `MINTER_ROLE` and
`EVOLVER_ROLE`; mint/evolve payloads are server-built; marketplace
transactions are user-signed. Not fully trustless.
