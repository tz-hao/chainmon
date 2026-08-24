# ChainMon ⛓️

A Web3 monster-collecting RPG deployed on **Monad Testnet**, combining
persistent off-chain progression with ERC-721 ownership, on-chain evolution,
and a non-custodial native-token (MON) marketplace.

Explore → Encounter → Capture → Collect → Team → 3v3 Battle → EXP/Level → Evolution → NFT → Marketplace.

> ⚠️ **Monad Testnet is a testing environment.** Contracts and assets on it
> are not production mainnet assets; testnets can be reset or upgraded.

## Network

| | |
| --- | --- |
| Network | Monad Testnet |
| Chain ID | 10143 |
| Currency | MON |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | [Monadscan](https://testnet.monadscan.com) |
| MonsterNFT | [`0xdF47d90c13DC34e1Cd5530352B414E24f1A2A7C7`](https://testnet.monadscan.com/address/0xdF47d90c13DC34e1Cd5530352B414E24f1A2A7C7) (Monad Testnet) |
| MonsterMarketplace | [`0x51B61cDe32D4DC39Cd2bfA0ecf8B8D2eE5b38D64`](https://testnet.monadscan.com/address/0x51B61cDe32D4DC39Cd2bfA0ecf8B8D2eE5b38D64) (Monad Testnet) |

> ⚠️ **Monad Testnet is a testing environment.** Contracts/assets on it are
> not production mainnet assets; testnets can be reset or upgraded.
>
> The Hardhat **localhost** development deployment (chainId 31337) is
> recorded separately in `contracts/deployments/localhost.json` — the web app
> must use the addresses matching its configured chain.

## Features

| Pillar | Details |
| --- | --- |
| Monster Collection | 28 species, DNA-based individuality (5 genes), rarity, elements |
| 3v3 Battle | Turn-based engine with element advantages, AI opponents, logs |
| Progression | EXP, levels, stat growth, gold, items, skill unlocks |
| Evolution | Level/item-gated evolution with history (FireCub → FireWolf → …), on-chain for minted monsters |
| NFT Ownership | ERC-721 `MonsterNFT` — identity (DNA hash, generation, rarity, stage) lives on-chain |
| Wallet Claim | Signature challenge → server-built mint payload → user wallet claims the NFT |
| Marketplace | Non-custodial `MonsterMarketplace` — approve / list / buy / cancel in native currency (MON on Monad), 0% fee |
| Ownership Sync | `ownerOf` is the source of truth; monster ownership follows the wallet across trainers |

## Architecture

```
Next.js (UI + Server Actions + API routes)
  ↓
Service Layer (claim / evolution-sync / marketplace / ownership-sync / capture / battle)
  ↓
Game Engine (pure TS: capture formula, battle resolution, EXP, evolution)
  ↓
Prisma / PostgreSQL (game state: trainer, monsters, battles, inventory, listings)

+ viem (server-only backend signer)
  ↓
MonsterNFT (ERC-721 identity)  ·  MonsterMarketplace (native-currency listings)
  ↓
Monad Testnet (chainId 10143)  ·  Hardhat Localhost (chainId 31337, dev/CI)
```

### On-chain vs Off-chain boundary

| On-chain (source of truth) | Off-chain (game state) |
| --- | --- |
| Ownership (`ownerOf`) | Level, EXP |
| Species identity, generation, rarity, evolution stage | Stats (HP/ATK/DEF/SPD), skills |
| DNA hash (immutable) | Battle state & logs |
| Game Monster ID hash | Inventory, gold |
| Marketplace listings & sales | Team slots |

### Trust model

**Trusted Game Operator Model** — the backend operator holds `MINTER_ROLE` and
`EVOLVER_ROLE` on `MonsterNFT`; all mint/evolve transactions are server-built
and paid by the operator. This is not a fully trustless system: the operator
can mint/evolve on behalf of verified users, and mint payloads are never
client-controlled. Marketplace transactions are signed by user wallets.

## Monorepo layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js 14 web app (App Router, TypeScript strict, Tailwind) |
| `packages/game-engine` | Pure game logic (battle / capture / damage / exp / evolution) |
| `packages/monster-data` | Monster species catalogue (28 species, 48 skills including 8 Web3 / 32 Knowledge skills, regions) |
| `packages/shared` | Shared domain types & constants |
| `prisma/` | PostgreSQL schema + seed |
| `contracts/` | Hardhat project: `MonsterNFT.sol`, `MonsterMarketplace.sol`, tests, ABI export |
| `scripts/` | Ops scripts: `audit-state.ts`, `validate-env.ts`, `monad-preflight.ts`, `browser-e2e.ts` |
| `docs/` | Deployment guide, demo script, phase status |

## Getting started (local, real PostgreSQL + local chain)

Prerequisites: Node ≥ 18, Docker (for PostgreSQL) — or an existing PostgreSQL 16.

```bash
# 1. Install
npm install

# 2. Start PostgreSQL (Docker) — creates db `chainmon`, user `chainmon`
docker compose up -d

# 3. Environment
Copy-Item .env.example .env          # root: DATABASE_URL + CHAINMON_DATA_MODE
Copy-Item apps/web/.env.example apps/web/.env.local   # web: chain + DB config

# 4. Prisma: validate → generate → push → seed (idempotent)
npm run db:generate
npm run db:push
npm run db:seed
npm run db:seed                      # second run must succeed (idempotency)

# 5. Local blockchain + contracts
cd contracts
npx hardhat node                     # keep running (http://127.0.0.1:8545, chainId 31337)
npx hardhat run scripts/deploy.ts --network localhost
# → copy MonsterNFT / MonsterMarketplace addresses into apps/web/.env.local
cd ..

# 6. Run the web app
npm run dev                          # http://localhost:3000
```

> Note: `CHAINMON_DATA_MODE=prisma` forces the real database (fail-closed).
> `CHAINMON_DATA_MODE=memory` opts into the in-memory Demo Mode (dev only).
> Production must never use memory mode.
> Set a high-entropy `CHAINMON_SESSION_SECRET` in `apps/web/.env.local` before
> production: wallet verification writes a signed, HttpOnly trainer session.

## Monad Testnet deployment (public testnet)

1. Get test MON from the Monad Testnet faucet (never buy mainnet MON).
2. Create `contracts/.env` (gitignored) with `MONAD_TESTNET_RPC_URL`,
   `MONAD_DEPLOYER_PRIVATE_KEY`, `MONADSCAN_API_KEY`.
3. Pre-flight (verifies RPC chainId = 10143, deployer balance):
   ```bash
   npm run monad:preflight
   ```
4. Deploy (sequential: MonsterNFT → MonsterMarketplace, receipts verified):
   ```bash
   npm run contracts:deploy:monad
   ```
5. Roles (deployer already holds MINTER/EVOLVER; grant to a separate
   operator wallet if used):
   ```bash
   OPERATOR_ADDRESS=0x... npm run contracts:grant-roles -- --network monadTestnet
   ```
6. Verify on Monadscan (constructor args required for the marketplace):
   ```bash
   npx hardhat verify --network monadTestnet <MonsterNFT address>
   npx hardhat verify --network monadTestnet <Marketplace address> <NFT address> <admin>
   ```
7. Point the web app at Monad (chainId 10143) and run `npm run validate:env:rpc`.

See `docs/deployment.md` for the full checklist.

## Commands

| Command | What |
| --- | --- |
| `npm test` | App unit tests (vitest) |
| `npm run lint` | ESLint (next lint) |
| `npm run build` | Production build (includes typecheck) |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run test:contracts` | Hardhat contract tests |
| `npm run contracts:compile` | Compile Solidity (EVM target: prague) |
| `npm run contracts:abi` | Export ABIs to `contracts/abis/` |
| `npm run db:generate` / `db:push` / `db:seed` | Prisma client / schema / seed |
| `npm run contracts:deploy:local` | Deploy to Hardhat localhost |
| `npm run contracts:deploy:monad` | Deploy to Monad Testnet |
| `npm run monad:preflight` | Monad RPC/deployer/balance check |
| `npm run audit:state` | Read-only DB ↔ chain consistency audit |
| `npm run validate:env:rpc` | Environment + RPC chainId validation |

Env-gated integration suites (run explicitly when the services are up):

```bash
# Real local chain integration (persistent hardhat node + contracts deployed)
RUN_CHAIN_INTEGRATION=1 npx vitest run apps/web/lib/web3/__tests__/chain-integration.test.ts apps/web/lib/web3/__tests__/chain-marketplace-integration.test.ts

# Real PostgreSQL integration (PostgreSQL up + seeded)
RUN_DATABASE_INTEGRATION=1 npx vitest run apps/web/lib/data/__tests__/database-integration.test.ts

# Full-loop E2E (PostgreSQL + local chain together)
RUN_E2E=1 RUN_CHAIN_INTEGRATION=1 npx vitest run apps/web/lib/data/__tests__/e2e-full-flow.test.ts apps/web/lib/data/__tests__/e2e-evolution.test.ts

# Real Monad Testnet integration (deployed contracts + funded wallets)
RUN_MONAD_TESTNET_INTEGRATION=1 npx vitest run apps/web/lib/web3/__tests__/monad-testnet-integration.test.ts
```

## Security

- **Double mint protection** — `gameMonsterIdHash` uniqueness enforced on-chain and by a DB CAS mint lock.
- **Wallet signature verification** — single-use nonce challenges; server verifies the signature.
- **Server-built mint payload** — clients submit only `monsterId`; species/rarity/DNA come from server state.
- **Receipt reconciliation** — `MINT_SUBMITTED`/`EVOLUTION_SUBMITTED` recover via receipt + on-chain read-back.
- **Reentrancy protection** — `MonsterMarketplace` uses `ReentrancyGuard`; checks-effects-interactions ordering.
- **Non-custodial marketplace** — 0% fee, no escrow, no admin withdrawal; exact native-currency payment required.
- **Ownership source of truth** — `ownerOf(tokenId)`; DB `ownerId` is a cached projection kept in sync.
- **No silent production fallback** — `CHAINMON_DATA_MODE=prisma` + production fail closed when the DB is down.
- **No secrets in the browser** — the minter private key lives only in server-only modules.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project scaffold, DB schema, base UI | ✅ |
| 2 | Monster data model, 28 species, collection | ✅ |
| 3 | Explore / Encounter / Capture | ✅ |
| 4 | 3v3 Battle engine | ✅ |
| 5 | Progression / Rewards / Evolution | ✅ |
| 6 | MonsterNFT smart contract | ✅ |
| 7 | Wallet / NFT claim / on-chain integration | ✅ |
| 8 | Marketplace / ownership sync | ✅ |
| 9 | Production readiness & final acceptance | ✅ |
| Final | Monad Testnet deployment & acceptance | ✅ |

See `docs/deployment.md` for production deployment steps and
`docs/demo-script.md` for the 5–8 minute demo.
