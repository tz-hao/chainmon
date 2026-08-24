# ChainMon Contracts — MonsterNFT + MonsterMarketplace

Two Solidity contracts backing ChainMon's on-chain layer (Hardhat + TypeScript
tests + ABI export).

## MonsterNFT

ERC-721 **asset identity** layer for ChainMon monsters — an Asset Identity
Contract, **not** a token.

**Trust model — Trusted Game Operator:**

- `MINTER_ROLE` — minting is restricted to the game backend (players can never
  mint a Legendary or forge DNA).
- `EVOLVER_ROLE` — evolution requires the game backend to first validate level,
  evolution items and routes **off-chain**.

The contract does **not** verify EXP, level, HP, skills, inventory, Fire Stone,
capture validity or battle results — those live in the game backend.

**Contract guarantees:**

- One NFT per game monster (`gameMonsterIdHash` uniqueness, double-mint reverts)
- ERC-721 ownership (`ownerOf`)
- Immutable asset identity after mint: `dnaHash`, `generation`,
  `gameMonsterIdHash` (no setters exist)
- Authorized mint / authorized evolution only
- Evolution preserves `tokenId` — the same NFT carries the monster's whole life
  history (FireCub → FireWolf → InfernoWolf on token #42)
- Pause (admin) as an emergency switch for mint / transfer / evolution
- No `burn` function

## MonsterMarketplace

Non-custodial ETH marketplace for ChainMon NFTs:

- **List / Buy / Cancel** with user-wallet signatures (server tracks state)
- **0% fee, no escrow, no admin withdrawal** — payment flows seller ← buyer
  directly (`payable(seller).call{value: price}` after `safeTransferFrom`)
- **Exact payment required** (`msg.value == price`), ReentrancyGuard +
  checks-effects-interactions ordering
- Buy re-validates seller ownership + marketplace approval
- Cancel allowed while paused (paused market: no list/buy)
- `CONTRACT_VERSION = "1.0.0"`; events `MonsterListed` / `ListingCancelled` /
  `MonsterSold`; custom errors for all failure paths

The marketplace never holds funds: the contract balance stays zero.

## Canonical hashing (TypeScript ↔ Solidity)

Never reorder. ABI encoding only — never JSON.

```text
DNA hash  = keccak256(abi.encode(hpGene, attackGene, defenseGene, speedGene, mutationGene))
Game ID   = keccak256(bytes(monster.id))
```

- TypeScript helpers: `scripts/hash-helpers.ts` (`hashMonsterDNA`,
  `hashGameMonsterId`, `buildMonsterMintPayload`)
- Cross-language verification: `contracts/test/DNAHashProbe.sol` +
  `test/MonsterNFT.test.ts` ("hash helpers" describe block)
- Rarity canonical mapping (`packages/shared/src/onchain.ts`):
  `0 = Common · 1 = Rare · 2 = Epic · 3 = Legendary`
- Evolution stage: `0 = base · 1 · 2` (`MAX_EVOLUTION_STAGE = 2`), computed
  off-chain via `getEvolutionStage(species)` in `packages/monster-data`.

## Roles

| Role | Permission |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | grant/revoke roles, setBaseURI, pause/unpause |
| `MINTER_ROLE` | `mintMonster()` |
| `EVOLVER_ROLE` | `evolveMonster()` |

Deployer receives all three roles at construction. **Production
recommendation:** separate the Admin wallet from the Backend Operator wallet
(operator holds MINTER + EVOLVER only); see `scripts/grant-roles.ts`.

## Commands

From the repo root:

```bash
npm run contracts:compile      # hardhat compile
npm run test:contracts         # hardhat test (74 contract tests)
npm run contracts:abi          # write abis/MonsterNFT.json + abis/MonsterMarketplace.json
npm run contracts:deploy:local # deploy on the ephemeral hardhat network (default)
```

Persistent localhost node (recommended for integration):

```bash
cd contracts
npx hardhat node                          # terminal 1 — http://127.0.0.1:8545
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/grant-roles.ts --network localhost   # OPERATOR_ADDRESS=...
```

## Deployment

Deployments are recorded to `deployments/{network}.json` (addresses, deployer,
tx hash, block number). Base Sepolia deployment is optional and only runs when
both `BASE_SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` are set in
`contracts/.env` (see `.env.example`). Private keys are never logged or
committed. `scripts/audit-state.ts` (repo root) performs a read-only
DB ↔ chain consistency audit.

## Future directions (documented only — NOT implemented)

- EIP-712 signed mint/evolution authorizations
- Merkle-proof based claims
- On-chain species registry
- ZK game proofs
