# ChainMon — Demo Script (5–8 minutes)

A complete walkthrough of ChainMon's core loop for demos, portfolio reviews
or hackathon judging. Total time: **5–8 minutes**.

> **Primary chain: Monad Testnet** (chainId 10143, MON) — real testnet
> transactions, verifiable on Monadscan. If the demo environment has
> unstable network access, Hardhat localhost is the fallback (same steps,
> ETH instead of MON).
>
> **Fixtures**: the Evolution step uses a pre-prepared demo monster (a minted
> FireCub at Lv 16 with a Fire Stone). Demo accounts: two wallets — A
> (seller) and B (buyer), each with test MON from the Monad faucet.

---

## Setup checklist (before the demo)

```bash
# 1. PostgreSQL (real)
docker compose up -d
npm run db:push && npm run db:seed

# 2. Monad Testnet contracts (or localhost fallback)
npm run monad:preflight                    # chainId 10143 + deployer balance
npm run contracts:deploy:monad             # records deployments/monadTestnet.json
# paste the real addresses into apps/web/.env.local (chainId 10143)

# 3. Web app
npm run dev                                # terminal 2 — http://localhost:3000
```

Quick sanity: `GET /api/health` → `status: "ok"`; `GET /api/web3/health` →
`connected:true, chainId:10143, rpcChainId:10143`.

---

## 1. Create Trainer (~30 s)

- Open the app → **Create Trainer**.
- Nickname: `Ash` — starter: **FireCub**.
- You land in the Collection with your starter.

*Point out*: trainer profile (gold 0, 0 battles), starter monster with DNA.

## 2. Capture Monsters (~1 min)

- **Explore** → pick a region → an Encounter appears.
- **Throw Ball** (Basic Ball) — capture succeeds.
- Repeat once or twice so the collection has **3+ monsters**.

*Point out*: unique DNA and stats per monster; balls decrease; encounter ends.

## 3. Collection (~20 s)

- **Monsters** page: grid of captured monsters with species, element, rarity,
  level. Open a monster detail page.

## 4. Battle (~1.5 min)

- **Team** → pick exactly **3 monsters** → save.
- **Battle** → 3v3 turn-based fight with the AI trainer.
- Win → battle completes.

*Point out*: EXP gained, gold reward, level-ups, skill unlocks, battle logs.

## 5. EXP / Level / Stats (~30 s)

- Reopen a monster: level increased, stats grew, EXP bar advanced.
- Trainer profile: wins/battleCount/gold updated.

## 6. NFT Claim on Monad (~1 min) — the Web3 moment

- **Profile / Wallet**: sign the verification challenge with Wallet A
  (MetaMask/Rabby — signature only, no gas).
- On a minted monster → **Claim NFT** → the backend operator submits the mint
  on **Monad Testnet**; the user confirms nothing extra.
- NFT panel shows **tokenId**, **Monad tx hash**, and a **Monadscan** link
  (`https://testnet.monadscan.com/tx/<hash>`).

*Point out*: the mint is a REAL Monad transaction; DNA hash matches the
on-chain read-back; `mintChainId=10143`.

## 7. Marketplace in MON (~1.5 min)

- **Marketplace** → My Listings → **Sell** the minted monster.
- Approve the marketplace (Wallet A tx) → set a small price (e.g. **0.001
  MON**) → **List** (Wallet A tx).
- The listing appears under **For Sale** with the **MON** label.
- Switch to Wallet B:
  - Create Trainer `Misty`, verify Wallet B.
  - Open the listing → **Buy** → confirm the MON transaction in Wallet B.
  - Monster disappears from Ash's collection and appears in Misty's (ownership
    sync).

*Point out*: no custody (MON goes seller → buyer directly), 0% fee, the
monster's DNA / level / history survive the sale.

## 8. Ownership Transfer → Buyer uses the monster (~30 s)

- As Misty: add the purchased monster to the team → start a battle → fight.

*Point out*: marketplace is connected to gameplay; the bought monster is fully
usable (gameplay lock only while listed).

## 9. Evolution (fixture, ~1 min)

- Use the prepared demo monster: **minted FireCub Lv 16** with a **Fire Stone**.
- **Evolve** → confirm the on-chain evolution transaction (Monad).
- Species becomes **FireWolf** (chain + DB); tokenId, DNA and owner unchanged.

*Point out*: on-chain identity stays immutable; evolution history recorded;
Monadscan shows the evolution tx.

---

## Fallbacks if something breaks

| Symptom | Action |
| --- | --- |
| Wallet not connecting | Add Monad Testnet (chainId 10143) in the wallet; refresh |
| RPC down / rate limited | Marketplace shows "temporarily unavailable" — off-chain gameplay still works; retry shortly |
| Stuck mint | Use "Refresh" — receipt reconciliation recovers the state |
| DB down (prisma mode) | `/api/health` shows database unavailable — app fails closed |
| Insufficient test MON | Monad Testnet faucet; do not buy mainnet MON |

## Honest boundaries to mention

- No PvP, no game token, no open world — a focused Web MVP.
- Marketplace is non-custodial with 0% fees; operator has MINTER/EVOLVER roles
  (Trusted Game Operator model).
- Monad Testnet is a testing environment — assets are not mainnet assets;
  testnets can reset.
