# ChainMon — Deployment Guide (Monad Testnet)

This guide covers deploying ChainMon to the **Monad Testnet** (chainId 10143,
native currency MON) plus local development on Hardhat localhost. Everything
here applies to a production-like environment: PostgreSQL, environment
configuration, Prisma, contract deployment, role setup, app deployment,
health checks and smoke tests.

---

## 1. PostgreSQL

Production requires a real PostgreSQL (≥ 14, tested on 16). Use a managed
database (RDS / Cloud SQL / Neon / Supabase) or a self-hosted instance.

For a public playtest, create a **new dedicated database**. Do not point these
steps at a previous development database and do not use `prisma db push` for
the release schema.

- Create a database and user, e.g.:
  ```sql
  CREATE DATABASE chainmon;
  CREATE USER chainmon WITH PASSWORD '<strong-password>';
  GRANT ALL PRIVILEGES ON DATABASE chainmon TO chainmon;
  ```
- Set `DATABASE_URL` in the app environment (never commit it):
  ```
  DATABASE_URL="postgresql://chainmon:<strong-password>@<host>:5432/chainmon?schema=public"
  ```
- **Backups**: configure automated backups (daily snapshots + WAL archiving;
  `pg_dump` cron on self-hosted). Restore drills recommended before go-live.

> Local development only: `docker compose up -d` starts PostgreSQL 16 with a
> throwaway password (`chainmon_local_dev`) — never reuse it in production.

## 2. Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CHAINMON_DATA_MODE` | ✅ | `prisma` in production (fail-closed; `memory` is dev-only) |
| `CHAINMON_SESSION_SECRET` | ✅ | 32+ random server-only bytes used to HMAC the HttpOnly wallet session |
| `CHAINMON_APP_ORIGIN` | Self-hosted only | Canonical `https://` origin for SIWE; Vercel derives a deployment origin from `VERCEL_URL` |
| `CHAINMON_CHAIN_ID` | ✅ | `10143` for Monad Testnet |
| `CHAINMON_RPC_URL` | ✅ | RPC for the target chain |
| `CHAINMON_MONSTER_NFT_ADDRESS` | ✅ | Deployed `MonsterNFT` address |
| `CHAINMON_MONSTER_MARKETPLACE_ADDRESS` | ✅ | Deployed `MonsterMarketplace` address |
| `CHAINMON_MINTER_PRIVATE_KEY` | ✅ | **Server-only.** Backend operator key (MINTER + EVOLVER). Use Vercel Env / Secret Manager / KMS. Never commit, never log. |
| `NEXT_PUBLIC_CHAINMON_CHAIN_ID` | ✅ | `10143` |
| `NEXT_PUBLIC_CHAINMON_RPC_URL` | ✅ | Browser-safe mirror of the Monad Testnet RPC URL |
| `NEXT_PUBLIC_MONSTER_NFT_ADDRESS` | ✅ | Client-side mirror of the NFT contract |
| `NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS` | ✅ | Client-side mirror of the marketplace |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | ✅ | `https://testnet.monadscan.com` |

Contracts deployment (in `contracts/.env`, gitignored):

| Variable | Notes |
| --- | --- |
| `MONAD_TESTNET_RPC_URL` | `https://testnet-rpc.monad.xyz` |
| `MONAD_DEPLOYER_PRIVATE_KEY` | Deployer key with test MON (faucet) |
| `MONADSCAN_API_KEY` | For contract verification |

For a testnet demo, `MONAD_DEPLOYER_PRIVATE_KEY` and
`CHAINMON_MINTER_PRIVATE_KEY` may be the same wallet; production design keeps
the Deployment/Admin wallet separate from the Backend Operator wallet.

Validate everything before booting:

```bash
npm run validate:env:rpc
npm run monad:preflight
```

Both verify the RPC reports chainId **10143** — deployment stops if not.

## 3. Prisma

```bash
npm run db:generate   # generate the Prisma client
npx prisma migrate deploy  # apply committed migrations to the new database
npm run db:seed            # idempotent canonical seed (species, skills, items)
```

Seed rows are upserted by unique keys — re-running never duplicates data. No
trainer, monster, test account, demo account or fallback data is seeded.

## 4. Contract Compilation (Monad)

Monad requires `evmVersion = "prague"` (already set in
`contracts/hardhat.config.ts`; optimizer + metadata preserved):

```bash
npm run contracts:compile   # confirms: evm target: prague
npm run contracts:abi       # writes abis/MonsterNFT.json + MonsterMarketplace.json
```

After any `evmVersion` change the full contract test suite must re-run:

```bash
npm run test:contracts      # 74/74 expected, 0 failed
```

## 5. Contract Deployment (Monad Testnet)

### 5.1 Get test MON

Monad Testnet faucet — test MON is free. Never buy mainnet MON for testnet
acceptance. No faucet automation is included (by design).

### 5.2 Configure

`contracts/.env` (gitignored):

```
MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_DEPLOYER_PRIVATE_KEY=<deployer key with test MON>
MONADSCAN_API_KEY=<optional, for verification>
```

### 5.3 Pre-flight

```bash
npm run monad:preflight
```

Checks: RPC chainId == 10143, latest block, deployer address (derived from
key, key never printed), MON balance > 0. Aborts with
`Insufficient Monad Testnet MON for deployment. Monad Testnet faucet required.`
when the balance is zero.

### 5.4 Deploy

```bash
npm run contracts:deploy:monad
```

The script (sequential — never parallel):

1. Deploys `MonsterNFT`, waits for the receipt, requires `status: success`.
2. Deploys `MonsterMarketplace(MonsterNFT, admin)`, waits, requires success.
3. Post-deploy checks: `eth_getCode` non-empty on both, `CONTRACT_VERSION ==
   "1.0.0"`, `Marketplace.monsterNFT() == MonsterNFT`.
4. Records `contracts/deployments/monadTestnet.json`:

```json
{
  "network": "monadTestnet",
  "chainId": 10143,
  "MonsterNFT": "0x…",
  "MonsterMarketplace": "0x…",
  "deployer": "0x…",
  "monsterNftDeploymentTx": "0x…",
  "marketplaceDeploymentTx": "0x…",
  "blockNumber": 123,
  "deployedAt": "…",
  "contractVersion": "1.0.0"
}
```

No secrets are ever written to deployment files.

## 6. Role Setup

Deployer receives `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `EVOLVER_ROLE` at
construction. If the backend operator differs from the deployer:

```bash
OPERATOR_ADDRESS=0x… npm run contracts:grant-roles -- --network monadTestnet
```

The script reads the NFT address from the deployment record, grants missing
roles, then **reads back** `hasRole` — both must be `true`.

**Production role separation:** Admin/Deployer wallet ≠ Backend Operator
wallet (operator holds MINTER + EVOLVER only). Testnet demo may share one
wallet. No multisig/KMS/role-rotation is forced for the demo.

## 7. Contract Verification (Monadscan)

Verification must use the exact same settings as deployment
(Solidity 0.8.28, evmVersion prague, optimizer runs 200, ipfs metadata):

```bash
npx hardhat verify --network monadTestnet <MonsterNFT address>
npx hardhat verify --network monadTestnet <Marketplace address> <NFT address> <admin address>
```

`MonsterMarketplace` verification requires its constructor args (NFT address,
admin). If the Hardhat CLI reports a misleading error but Monadscan shows the
contract verified, trust the explorer after checking it manually.

## 8. Configure the Web App

Point `apps/web/.env.local` (or the hosting environment) at Monad:

```
CHAINMON_CHAIN_ID=10143
CHAINMON_RPC_URL=https://testnet-rpc.monad.xyz
CHAINMON_MONSTER_NFT_ADDRESS=<from deployments/monadTestnet.json>
CHAINMON_MONSTER_MARKETPLACE_ADDRESS=<from deployments/monadTestnet.json>
CHAINMON_MINTER_PRIVATE_KEY=<operator key with MINTER+EVOLVER>
CHAINMON_SESSION_SECRET=<32+ random server-only bytes>
NEXT_PUBLIC_CHAINMON_CHAIN_ID=10143
NEXT_PUBLIC_CHAINMON_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONSTER_NFT_ADDRESS=<same NFT address>
NEXT_PUBLIC_MONSTER_MARKETPLACE_ADDRESS=<same marketplace address>
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://testnet.monadscan.com
```

The marketplace UI derives the currency label from the chain config — Monad
Testnet displays **MON** automatically (never a hardcoded ETH label for native
payments).

## 9. App Deployment

Next.js 15 App Router. Server runtime must support Prisma and the viem
backend signer (Node runtime with egress to the RPC).

```bash
npm ci
npm run build
npm start          # or the platform's Node start command
```

Never run production with `CHAINMON_DATA_MODE=memory`.

## 10. Health Check

- `GET /api/health` — aggregate: `app`, `database`, `rpc`, `monsterNFT`,
  `marketplace`, `backend` roles. Never leaks secrets.
- `GET /api/web3/health` — `connected`, `chainId` + `rpcChainId` (mismatch ⇒
  `chainMisconfigured`), contract versions, role checks,
  `marketplaceMisconfigured`.

Monad acceptance: `connected=true`, `chainId=10143`, `rpcChainId=10143`,
`chainMisconfigured=false`, `minterRole=true`, `evolverRole=true`,
`marketplacePaused=false`.

## 11. Mint Smoke (Monad)

Through the app: claim an NFT on a minted monster → expect
OFFCHAIN → MINT_PENDING → MINT_SUBMITTED → Monad receipt success →
MINT_CONFIRMED with `mintChainId=10143` and the Monad NFT address. Verify on
Monadscan: `https://testnet.monadscan.com/tx/<hash>`.

## 12. Marketplace Smoke (Monad)

Seller wallet: approve → list (small test price, e.g. 0.001 MON). Buyer
wallet (different): buy with exact MON value. Verify `ownerOf == buyer`,
listing inactive, seller MON balance increased, marketplace balance stays 0.
Ownership sync then moves the monster in the DB to the buyer's trainer.

## Operations notes

- **Backups** — mandatory (see §1).
- **Logging** — never log private keys, wallet signatures, nonce secrets or
  the `DATABASE_URL` password. `txHash`, `monsterId`, `tokenId`, `status`,
  `chainId` are fine.
- **Recovery** — minted/evolution-submitted/listings recover via receipt
  reconciliation + `reconcileListing`; `npm run audit:state` is read-only.
- **Rate limiting** — MVP in-process limiter recommended for
  `/api/auth/nonce`, `/api/auth/verify`, `/api/nft/claim`, `/api/nft/refresh`
  before public launch.
- **RPC failures** — Monad public RPC may rate-limit; UI shows
  "temporarily unavailable" (no 500); submitted txs stay SUBMITTED/PENDING
  until a manual Refresh reconciles them.
