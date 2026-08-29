import type {
  RiftConfig,
  RiftId,
  RiftProtocolEvent,
  RiftRouteTemplate,
} from "./types";

const LIQUIDITY_ROUTE: RiftRouteTemplate = {
  openingEvent: { id: "pool-gate", title: "Pool Gate", subtitle: "Choose a liquidity signal" },
  openingBattle: { id: "route-keepers", title: "Route Keepers", subtitle: "Test the market path" },
  capture: { id: "swap-current", title: "Swap Current", subtitle: "A shifting signal appears" },
  convergenceEvent: { id: "order-canopy", title: "Order Canopy", subtitle: "Read the transaction flow" },
  rest: { id: "reserve-rest", title: "Reserve Rest", subtitle: "Rebalance the expedition" },
  standardBattle: { id: "depth-guard", title: "Depth Guard", subtitle: "Hold the execution line" },
  elite: { id: "oracle-watch", title: "Oracle Watch", subtitle: "Elite signal guardian" },
  boss: { id: "mev-thicket", title: "MevMantis", subtitle: "Boss · Ordering pressure" },
};

const PROOF_ROUTE: RiftRouteTemplate = {
  openingEvent: { id: "oracle-drift", title: "Oracle Drift", subtitle: "Choose a verification path" },
  openingBattle: { id: "feed-sentinel", title: "Feed Sentinel", subtitle: "Protect the public statement" },
  capture: { id: "hidden-signal", title: "Hidden Signal", subtitle: "A witness signal appears" },
  convergenceEvent: { id: "witness-gate", title: "Witness Gate", subtitle: "Resolve the proof route" },
  rest: { id: "proof-chamber", title: "Proof Chamber", subtitle: "Stabilize the proof" },
  standardBattle: { id: "verification-duel", title: "Verification Duel", subtitle: "Defend the verification path" },
  elite: { id: "consensus-keeper", title: "Consensus Keeper", subtitle: "Elite proof sentinel" },
  boss: { id: "zkbat-sanctum", title: "ZkBat", subtitle: "Boss · Hidden Witness" },
};

const GAS_ROUTE: RiftRouteTemplate = {
  openingEvent: { id: "congestion-spike", title: "Congestion Spike", subtitle: "Choose an execution route" },
  openingBattle: { id: "gas-burner", title: "Gas Burner", subtitle: "Break through congestion" },
  capture: { id: "route-signal", title: "Route Signal", subtitle: "A volatile signal appears" },
  convergenceEvent: { id: "priority-lane", title: "Priority Lane", subtitle: "Route around the backlog" },
  rest: { id: "cooling-relay", title: "Cooling Relay", subtitle: "Cool the execution engine" },
  standardBattle: { id: "execution-clash", title: "Execution Clash", subtitle: "Hold inclusion priority" },
  elite: { id: "block-burner", title: "Block Burner", subtitle: "Elite congestion runner" },
  boss: { id: "bridgefox-crossing", title: "BridgeFox", subtitle: "Boss · Cross-Chain Warden" },
};

const CREDIT_ROUTE: RiftRouteTemplate = {
  openingEvent: { id: "collateral-roots", title: "Collateral Roots", subtitle: "Choose a credit posture" },
  openingBattle: { id: "debt-shade", title: "Debt Shade", subtitle: "Protect the health factor" },
  capture: { id: "lending-signal", title: "Lending Signal", subtitle: "A secured signal appears" },
  convergenceEvent: { id: "health-threshold", title: "Health Threshold", subtitle: "Read the threshold" },
  rest: { id: "reserve-vault", title: "Reserve Vault", subtitle: "Restore the safety margin" },
  standardBattle: { id: "credit-pressure", title: "Credit Pressure", subtitle: "Defend the collateral line" },
  elite: { id: "liquidation-keeper", title: "Liquidation Keeper", subtitle: "Elite credit guardian" },
  boss: { id: "vaultturtle-deep", title: "VaultTurtle", subtitle: "Boss · Last Custodian" },
};

export const RIFT_CONFIGS = [
  {
    id: "liquidity-grove",
    ordinal: "RIFT 01",
    name: "Liquidity Grove",
    eyebrow: "AMM · SWAP · LIQUIDITY",
    description: "A living market where routes, depth and ordering reshape every encounter.",
    concepts: ["AMM", "Swap", "Liquidity", "Slippage", "MEV"],
    difficulty: "Calibrated",
    recommendedLevel: "Lv. 1+",
    runDuration: "8 nodes",
    featuredSpeciesIds: [21, 22, 27],
    encounterPool: [21, 26, 11, 12, 5],
    captureSpeciesIds: [21],
    eliteSpeciesId: 22,
    bossSpeciesId: 27,
    bossTitle: "MevMantis · Order Sovereign",
    eventIds: ["amm-depth", "slippage-corridor", "mev-thicket"],
    route: LIQUIDITY_ROUTE,
    levels: { opening: 1, standard: 2, elite: 3, boss: 4 },
    multipliers: { opening: 0.43, standard: 0.46, elite: 0.5, boss: 0.56 },
    summaryTitle: "Liquidity route stabilized",
  },
  {
    id: "proof-network",
    ordinal: "RIFT 02",
    name: "Proof Network",
    eyebrow: "ORACLE · ZK · CONSENSUS",
    description: "A cyan and indigo network where witness signals become verifiable public facts.",
    concepts: ["Oracle", "ZK Proof", "Verifier", "Witness", "Consensus"],
    difficulty: "Measured",
    recommendedLevel: "Lv. 3+",
    runDuration: "8 nodes",
    featuredSpeciesIds: [22, 23, 20],
    encounterPool: [22, 17, 19, 11, 12],
    captureSpeciesIds: [22],
    eliteSpeciesId: 20,
    bossSpeciesId: 23,
    bossTitle: "ZkBat · Hidden Witness",
    eventIds: ["oracle-divergence", "hidden-witness", "consensus-delay"],
    route: PROOF_ROUTE,
    levels: { opening: 1, standard: 2, elite: 3, boss: 4 },
    multipliers: { opening: 0.43, standard: 0.46, elite: 0.5, boss: 0.56 },
    summaryTitle: "Proof Network verified",
  },
  {
    id: "gas-wasteland",
    ordinal: "RIFT 03",
    name: "Gas Wasteland",
    eyebrow: "GAS · EXECUTION · CONGESTION",
    description: "An amber execution frontier where inclusion, timing and routes compete for scarce blockspace.",
    concepts: ["Gas", "Mempool", "Priority Fee", "Execution", "Bridge"],
    difficulty: "Demanding",
    recommendedLevel: "Lv. 5+",
    runDuration: "8 nodes",
    featuredSpeciesIds: [26, 24, 27],
    encounterPool: [26, 5, 17, 11, 12],
    captureSpeciesIds: [26],
    eliteSpeciesId: 26,
    bossSpeciesId: 24,
    bossTitle: "BridgeFox · Cross-Chain Warden",
    eventIds: ["congestion-spike", "priority-lane", "bridge-route"],
    route: GAS_ROUTE,
    levels: { opening: 1, standard: 2, elite: 3, boss: 4 },
    multipliers: { opening: 0.45, standard: 0.48, elite: 0.52, boss: 0.58 },
    summaryTitle: "Gas Wasteland cleared",
  },
  {
    id: "credit-abyss",
    ordinal: "RIFT 04",
    name: "Credit Abyss",
    eyebrow: "LENDING · COLLATERAL · LIQUIDATION",
    description: "A deep blue credit layer where health factors, custody and debt decide the route forward.",
    concepts: ["Lending", "Collateral", "Health Factor", "Liquidation", "Custody"],
    difficulty: "High stakes",
    recommendedLevel: "Lv. 7+",
    runDuration: "8 nodes",
    featuredSpeciesIds: [25, 28, 22],
    encounterPool: [6, 7, 11, 12, 16],
    captureSpeciesIds: [25],
    eliteSpeciesId: 25,
    bossSpeciesId: 28,
    bossTitle: "VaultTurtle · Last Custodian",
    eventIds: ["collateral-roots", "health-factor", "liquidation-threshold", "custody-boundary"],
    route: CREDIT_ROUTE,
    levels: { opening: 1, standard: 2, elite: 3, boss: 4 },
    multipliers: { opening: 0.46, standard: 0.5, elite: 0.54, boss: 0.6 },
    summaryTitle: "Credit Abyss secured",
  },
] as const satisfies readonly RiftConfig[];

export const RIFT_CATALOGUE = RIFT_CONFIGS;

export const RIFT_PROTOCOL_EVENTS: readonly RiftProtocolEvent[] = [
  {
    id: "amm-depth", riftId: "liquidity-grove", protocol: "AMM", title: "The Living Pool",
    premise: "Pool reserves pull the route in opposite directions as liquidity shifts beneath the grove.",
    insight: "AMMs price swaps from pooled reserves and a formula rather than a traditional order book.",
    choices: [
      { id: "concentrated", label: "Concentrate the route", detail: "Follow the deepest band for a sharper signal.", modifier: { id: "dense-liquidity", label: "Dense Liquidity", description: "+2 Signal for this rift run.", axis: "signal", amount: 2 } },
      { id: "wide", label: "Spread across the pool", detail: "Keep a wider reserve margin around price movement.", modifier: { id: "wide-reserves", label: "Wide Reserves", description: "+2 Guard for this rift run.", axis: "guard", amount: 2 } },
    ],
  },
  {
    id: "slippage-corridor", riftId: "liquidity-grove", protocol: "SLIPPAGE", title: "Slippage Corridor",
    premise: "The quoted route moves with every step; the safe bound and the fast path no longer agree.",
    insight: "Slippage is the gap between an expected execution price and the price actually received.",
    choices: [
      { id: "tight", label: "Set a tight limit", detail: "Protect the expected route from unstable execution.", modifier: { id: "price-discipline", label: "Price Discipline", description: "+2 Guard for this rift run.", axis: "guard", amount: 2 } },
      { id: "flexible", label: "Allow flexible execution", detail: "Keep moving before the corridor closes.", modifier: { id: "adaptive-routing", label: "Adaptive Routing", description: "+2 Tempo for this rift run.", axis: "tempo", amount: 2 } },
    ],
  },
  {
    id: "mev-thicket", riftId: "liquidity-grove", protocol: "MEV", title: "Ordering Pressure",
    premise: "MevMantis watches the public route and shifts into the execution order around it.",
    insight: "MEV is value extracted by changing transaction ordering, inclusion or exclusion inside a block.",
    choices: [
      { id: "private", label: "Use a private relay", detail: "Shield the route until the path reaches execution.", modifier: { id: "shielded-orderflow", label: "Shielded Orderflow", description: "+3 Signal for this rift run.", axis: "signal", amount: 3 } },
      { id: "public", label: "Race the public mempool", detail: "Reveal the route and prioritize raw timing.", modifier: { id: "mempool-rush", label: "Mempool Rush", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "oracle-divergence", riftId: "proof-network", protocol: "ORACLE", title: "Oracle Divergence",
    premise: "Two trusted price feeds disagree by 8.4%. The newest observation is not necessarily the most trustworthy one.",
    insight: "Oracles carry external facts on-chain, so source quality and aggregation define their reliability.",
    choices: [
      { id: "confirmation", label: "Wait for confirmation", detail: "Let independent witness observations converge.", modifier: { id: "verified-witness", label: "Verified Witness", description: "+3 Signal for this rift run.", axis: "signal", amount: 3 } },
      { id: "newest", label: "Trust the newest feed", detail: "Move while the latest observation still leads.", modifier: { id: "fresh-witness", label: "Fresh Witness", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "hidden-witness", riftId: "proof-network", protocol: "ZK PROOF", title: "Hidden Witness",
    premise: "The network asks for a valid statement without asking the expedition to expose its private path.",
    insight: "Zero-knowledge proofs demonstrate that a statement is true without revealing the underlying witness.",
    choices: [
      { id: "verify", label: "Verify the proof", detail: "Accept a valid statement without exposing its witness.", modifier: { id: "compact-proof", label: "Proof Guard", description: "+2 Guard for this rift run.", axis: "guard", amount: 2 } },
      { id: "demand", label: "Demand the raw data", detail: "Trade privacy for a directly visible verification path.", modifier: { id: "visible-cost", label: "Visible Cost", description: "+2 Tempo for this rift run.", axis: "tempo", amount: 2 } },
    ],
  },
  {
    id: "consensus-delay", riftId: "proof-network", protocol: "CONSENSUS", title: "Consensus Delay",
    premise: "The verification set has the proof, but final agreement arrives one beat behind the route.",
    insight: "Consensus turns independently observed information into a shared state that the network can trust.",
    choices: [
      { id: "finality", label: "Wait for stronger finality", detail: "Let the full validator set confirm the state transition.", modifier: { id: "quorum-guard", label: "Consensus Guard", description: "+3 Guard for this rift run.", axis: "guard", amount: 3 } },
      { id: "early", label: "Proceed early", detail: "Move under a provisional result while agreement catches up.", modifier: { id: "optimistic-tempo", label: "Early Tempo", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "congestion-spike", riftId: "gas-wasteland", protocol: "GAS", title: "Congestion Spike",
    premise: "Pending actions flood the wasteland and the fee gauge climbs with every blocked route.",
    insight: "Gas prices reflect competition for scarce execution capacity; priority fees can change inclusion timing.",
    choices: [
      { id: "wait", label: "Wait for pressure to drop", detail: "Let the pressure clear before committing.", modifier: { id: "patient-execution", label: "Patient Execution", description: "+2 Guard for this rift run.", axis: "guard", amount: 2 } },
      { id: "priority", label: "Increase priority", detail: "Move before the visible opportunity expires.", modifier: { id: "priority-lane", label: "Priority Lane", description: "+2 Tempo for this rift run.", axis: "tempo", amount: 2 } },
    ],
  },
  {
    id: "priority-lane", riftId: "gas-wasteland", protocol: "EXECUTION", title: "Priority Lane",
    premise: "A narrow inclusion lane opens between two congested blocks. It favors prepared routes.",
    insight: "Execution priority is negotiated by fee policy, transaction constraints and the current block builder.",
    choices: [
      { id: "conservative", label: "Bid conservatively", detail: "Protect the fee reserve while waiting for inclusion.", modifier: { id: "bundled-route", label: "Reserve Signal", description: "+3 Signal for this rift run.", axis: "signal", amount: 3 } },
      { id: "aggressive", label: "Bid aggressively", detail: "Pay for timing while the next block space remains open.", modifier: { id: "lane-rush", label: "Lane Rush", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "bridge-route", riftId: "gas-wasteland", protocol: "BRIDGE", title: "Bridge Route",
    premise: "BridgeFox offers a detour through another execution domain while the direct path remains blocked.",
    insight: "Bridges coordinate state and assets across networks, so route assumptions and finality boundaries matter.",
    choices: [
      { id: "redundant", label: "Take the redundant route", detail: "Choose more verifier coverage before crossing.", modifier: { id: "relay-guard", label: "Bridge Redundancy", description: "+3 Guard for this rift run.", axis: "guard", amount: 3 } },
      { id: "fast-route", label: "Take the fast route", detail: "Favor a shorter route through the execution gap.", modifier: { id: "fast-bridge", label: "Fast Bridge", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "collateral-roots", riftId: "credit-abyss", protocol: "COLLATERAL", title: "Collateral Roots",
    premise: "Borrowed strength reaches upward, but every root remains tied to the margin below.",
    insight: "Collateral gives lenders a safety buffer, allowing credit to work without a central intermediary.",
    choices: [
      { id: "over-collateralize", label: "Over-collateralize", detail: "Keep more reserve strength against the threshold.", modifier: { id: "healthy-collateral", label: "Healthy Collateral", description: "+3 Guard for this rift run.", axis: "guard", amount: 3 } },
      { id: "utilize", label: "Maximize utilization", detail: "Use more of the available credit to accelerate.", modifier: { id: "leveraged-tempo", label: "Leveraged Tempo", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "health-factor", riftId: "credit-abyss", protocol: "LENDING", title: "Health Factor",
    premise: "The credit gauge narrows as collateral value and borrowed value drift toward each other.",
    insight: "A health factor compares collateral strength with debt exposure; a lower ratio means less room for volatility.",
    choices: [
      { id: "add-collateral", label: "Add collateral", detail: "Restore distance from the fragile edge.", modifier: { id: "credit-buffer", label: "Credit Buffer", description: "+2 Guard for this rift run.", axis: "guard", amount: 2 } },
      { id: "maintain-leverage", label: "Maintain leverage", detail: "Preserve the current exposure while the route recovers.", modifier: { id: "credit-rotation", label: "Leverage Tempo", description: "+2 Tempo for this rift run.", axis: "tempo", amount: 2 } },
    ],
  },
  {
    id: "liquidation-threshold", riftId: "credit-abyss", protocol: "LIQUIDATION", title: "Liquidation Threshold",
    premise: "The descent reaches a marked threshold: cross it, and the route must unwind to protect the credit pool.",
    insight: "Liquidation rules close unsafe positions before a lending pool absorbs losses from insufficient collateral.",
    choices: [
      { id: "repay", label: "Repay part of the debt", detail: "Take the slower route and protect the buffer.", modifier: { id: "threshold-guard", label: "Liquidation Buffer", description: "+3 Guard for this rift run.", axis: "guard", amount: 3 } },
      { id: "hold", label: "Hold the position", detail: "Keep exposure open for the next price window.", modifier: { id: "recovery-tempo", label: "Position Tempo", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
  {
    id: "custody-boundary", riftId: "credit-abyss", protocol: "CUSTODY", title: "Custody Boundary",
    premise: "VaultTurtle waits beyond the custody boundary where control, settlement and recovery diverge.",
    insight: "Custody defines who can authorize movement and how recovery works when a position becomes stressed.",
    choices: [
      { id: "direct", label: "Retain direct custody", detail: "Keep control with the expedition through the final custody gate.", modifier: { id: "direct-custody", label: "Direct Custody", description: "+3 Signal for this rift run.", axis: "signal", amount: 3 } },
      { id: "delegate", label: "Delegate custody", detail: "Trade control for a more convenient settlement handoff.", modifier: { id: "delegated-custody", label: "Delegated Custody", description: "+3 Tempo for this rift run.", axis: "tempo", amount: 3 } },
    ],
  },
];

export function isRiftId(value: unknown): value is RiftId {
  return typeof value === "string" && RIFT_CONFIGS.some((rift) => rift.id === value);
}

export function getRiftConfig(riftId: RiftId): RiftConfig {
  const rift = RIFT_CONFIGS.find((candidate) => candidate.id === riftId);
  if (!rift) throw new Error(`Unknown rift: ${riftId}`);
  return rift;
}

export function getRiftEvent(eventId: string): RiftProtocolEvent | undefined {
  return RIFT_PROTOCOL_EVENTS.find((event) => event.id === eventId);
}

export function getRiftEvents(riftId: RiftId): readonly RiftProtocolEvent[] {
  return RIFT_PROTOCOL_EVENTS.filter((event) => event.riftId === riftId);
}
