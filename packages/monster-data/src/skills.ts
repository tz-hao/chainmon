/**
 * @chainmon/monster-data — skills.ts
 * Base skill catalogue (Phase 2): 16 skills, 4 per element.
 * No status effects / buffs / debuffs yet (later phases).
 */

import type { Element, Skill } from "@chainmon/shared";

function makeSkill(
  id: string,
  name: string,
  element: Element,
  power: number,
  accuracy: number,
  description: string,
): Skill {
  return { id, name, element, power, accuracy, description };
}

export const BASE_SKILLS: readonly Skill[] = [
  // Fire
  makeSkill("ember", "Ember", "fire", 35, 100, "A tiny flame that scorches the target."),
  makeSkill("fire-fang", "Fire Fang", "fire", 60, 95, "The user bites with flame-wreathed fangs."),
  makeSkill("flame-burst", "Flame Burst", "fire", 75, 90, "A bursting flame that erupts on impact."),
  makeSkill("inferno-blast", "Inferno Blast", "fire", 100, 85, "An overwhelming blast of searing fire."),
  // Water
  makeSkill("water-gun", "Water Gun", "water", 40, 100, "Water is blasted at the target."),
  makeSkill("bubble-beam", "Bubble Beam", "water", 55, 95, "A stream of bubbles that strikes the target."),
  makeSkill("aqua-tail", "Aqua Tail", "water", 70, 90, "A swinging tail strike wrapped in water."),
  makeSkill("hydro-cannon", "Hydro Cannon", "water", 95, 85, "A colossal water cannon fired at the target."),
  // Nature
  makeSkill("leaf-slap", "Leaf Slap", "nature", 40, 100, "Sharp leaves are flung at the target."),
  makeSkill("vine-whip", "Vine Whip", "nature", 55, 95, "The target is struck with slender vines."),
  makeSkill("thorn-spike", "Thorn Spike", "nature", 70, 90, "Piercing thorns are launched at the target."),
  makeSkill("solar-blade", "Solar Blade", "nature", 95, 85, "A blade of gathered sunlight cuts the target."),
  // Electric
  makeSkill("spark", "Spark", "electric", 40, 100, "The user charges the target with a spark."),
  makeSkill("shock-wave", "Shock Wave", "electric", 55, 95, "A quick jolt of electricity zaps the target."),
  makeSkill("thunder-fang", "Thunder Fang", "electric", 70, 90, "The user bites with electrified fangs."),
  makeSkill("thunderbolt", "Thunderbolt", "electric", 90, 90, "A strong electric blast is loosed at the target."),
];

// ---------- Web3 skills (Pixel World Upgrade) — 8 concepts × 4 skills ----------

function makeWeb3Skill(
  id: string,
  name: string,
  element: Element,
  power: number,
  accuracy: number,
  description: string,
  knowledgeTitle: string,
  knowledgeSummary: string,
): Skill {
  return {
    id,
    name,
    element,
    power,
    accuracy,
    description,
    knowledgeTitle,
    knowledgeSummary,
  };
}

const WEB3_SKILLS: readonly Skill[] = [
  // --- Swapicorn (DEX / AMM) ---
  makeWeb3Skill("swap-dash", "Swap Dash", "electric", 55, 100, "A lightning dash powered by token exchange.", "Swap", "Swap allows users to exchange one asset for another through a decentralized exchange."),
  makeWeb3Skill("liquidity-shield", "Liquidity Shield", "electric", 50, 100, "Wraps the user in pooled liquidity, raising Defense.", "Liquidity Pool", "Liquidity providers deposit assets into pools that enable swaps."),
  makeWeb3Skill("slippage-strike", "Slippage Strike", "electric", 70, 90, "Strikes with the gap between expected and actual price.", "Slippage", "Slippage is the difference between the expected and actual execution price of a trade."),
  makeWeb3Skill("amm-burst", "AMM Burst", "electric", 92, 85, "Unleashes the pool's formula as a burst of energy.", "AMM", "Automated Market Makers use liquidity pools and formulas rather than traditional order books."),

  // --- OracleOwl (Oracle / Price Feed) ---
  makeWeb3Skill("price-feed", "Price Feed", "nature", 55, 100, "Quotes an off-chain price that sharpens the next strike.", "Oracle", "Smart contracts need oracle systems to obtain information that does not exist natively on-chain."),
  makeWeb3Skill("oracle-guard", "Oracle Guard", "nature", 50, 100, "A barrier of verified data, raising Defense.", "Price Feed", "A price feed is a stream of asset prices delivered to smart contracts by an oracle."),
  makeWeb3Skill("data-verify", "Data Verify", "nature", 70, 90, "Checks the data, then strikes where it is true.", "Off-chain Data", "Oracles bridge off-chain data into on-chain execution."),
  makeWeb3Skill("market-signal", "Market Signal", "nature", 92, 85, "Broadcasts a market-wide pulse of verified information.", "Oracle Network", "Decentralized oracle networks aggregate multiple sources to resist manipulation."),

  // --- ZkBat (ZK) ---
  makeWeb3Skill("zk-veil", "ZK Veil", "electric", 55, 100, "A privacy veil that conceals the user's secrets.", "Zero-Knowledge Proof", "Zero-knowledge proofs allow someone to prove a statement without revealing the secret information behind it."),
  makeWeb3Skill("proof-pulse", "Proof Pulse", "electric", 60, 95, "A pulse of cryptographic proof that cannot be forged.", "Prover", "A prover generates a proof that a computation was performed correctly."),
  makeWeb3Skill("hidden-witness", "Hidden Witness", "electric", 70, 90, "Strikes from a position the witness never reveals.", "Witness", "In ZK systems the witness is the secret input that stays hidden while its validity is proven."),
  makeWeb3Skill("zero-burst", "Zero Burst", "electric", 92, 85, "Detonates a burst that proves knowledge of nothing — yet everything.", "Verifier", "A verifier checks a proof efficiently without learning the secret."),

  // --- BridgeFox (Bridge) ---
  makeWeb3Skill("chain-hop", "Chain Hop", "fire", 55, 100, "Leaps between chains leaving a trail of portal embers.", "Bridge", "Cross-chain bridges transfer assets or messages between different blockchain networks and introduce additional security assumptions."),
  makeWeb3Skill("portal-step", "Portal Step", "fire", 50, 100, "A portal flicker that raises Speed.", "Lock and Mint", "Some bridges lock tokens on one chain and mint wrapped versions on another."),
  makeWeb3Skill("relay-strike", "Relay Strike", "fire", 70, 90, "A strike relayed across two chains at once.", "Relayer", "A relayer carries messages or transactions between chains."),
  makeWeb3Skill("bridge-lock", "Bridge Lock", "fire", 92, 85, "Locks the target in place across the network divide.", "Wrapped Asset", "Wrapped assets represent an underlying token from another chain."),

  // --- Lendgeist (Lending) ---
  makeWeb3Skill("collateral-lock", "Collateral Lock", "water", 55, 100, "Locks collateral into a vault, raising Defense.", "Collateral", "DeFi lending commonly uses collateral, interest and liquidation to manage credit risk."),
  makeWeb3Skill("interest-drain", "Interest Drain", "water", 55, 100, "Siphons the target's strength like accruing interest.", "Interest", "Borrowers pay interest to lenders as the cost of using borrowed funds."),
  makeWeb3Skill("borrow-mist", "Borrow Mist", "water", 70, 90, "A mist that borrows the target's power and pays it back later.", "Lending Pool", "Lending pools aggregate deposits and issue loans from them."),
  makeWeb3Skill("liquidation", "Liquidation", "water", 92, 85, "Triggers a liquidation cascade on the over-leveraged target.", "Liquidation", "Liquidation sells a borrower's collateral when its value falls below the required ratio."),

  // --- GasGoblin (Gas) ---
  makeWeb3Skill("gas-spike", "Gas Spike", "fire", 45, 100, "A sudden spike in pressure that burns the target.", "Gas", "Gas represents the computational resources required to execute blockchain transactions."),
  makeWeb3Skill("priority-rush", "Priority Rush", "fire", 45, 100, "Pays a priority fee to move first, raising Speed.", "Priority Fee", "Users pay a priority fee to incentivize validators to include their transaction sooner."),
  makeWeb3Skill("congestion-cloud", "Congestion Cloud", "fire", 60, 90, "A cloud of network congestion that slows the target.", "Gas Limit", "A gas limit caps how much computation a transaction may consume."),
  makeWeb3Skill("fee-burn", "Fee Burn", "fire", 80, 85, "Burns accumulated fees into a fiery blow.", "Base Fee", "Some networks burn a base fee, reducing the token supply over time."),

  // --- MevMantis (MEV) ---
  makeWeb3Skill("front-run", "Front Run", "nature", 55, 100, "Strikes first by ordering transactions ahead of the target.", "MEV", "MEV refers to value that can be extracted through transaction ordering, inclusion or exclusion."),
  makeWeb3Skill("back-run", "Back Run", "nature", 60, 95, "Strikes after the target commits, profiting from the aftermath.", "Mempool", "The mempool is the public waiting area for transactions before they are included in blocks."),
  makeWeb3Skill("sandwich-cut", "Sandwich Cut", "nature", 75, 90, "A two-sided cut that squeezes the target's transaction.", "Sandwich Attack", "A sandwich attack places transactions before and after a victim's trade to profit from price movement."),
  makeWeb3Skill("mev-extract", "MEV Extract", "nature", 92, 85, "Extracts maximum value from the ordering of the battle.", "Block Builder", "Block builders choose transaction ordering within a block."),

  // --- VaultTurtle (Self Custody) ---
  makeWeb3Skill("cold-guard", "Cold Guard", "water", 60, 100, "Withdraws into a cold shell, greatly raising Defense.", "Self Custody", "Self-custody means the user controls the cryptographic keys required to access their assets."),
  makeWeb3Skill("hash-wall", "Hash Wall", "water", 60, 95, "A wall of hashed secrets that blocks incoming attacks.", "Private Key", "A private key is a secret number that signs transactions and proves ownership."),
  makeWeb3Skill("self-custody", "Self Custody", "water", 75, 90, "A heavy strike backed by the weight of full key control.", "Seed Phrase", "A seed phrase is a human-readable backup that can recover a wallet's keys."),
  makeWeb3Skill("recovery-seed", "Recovery Seed", "water", 92, 85, "Regenerates power from a recovery seed — nothing is lost.", "Hardware Wallet", "Hardware wallets keep keys in a dedicated device isolated from online threats."),
];

export const SKILLS: readonly Skill[] = [...BASE_SKILLS, ...WEB3_SKILLS];

export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function getSkillsByElement(element: Element): readonly Skill[] {
  return SKILLS.filter((s) => s.element === element);
}

