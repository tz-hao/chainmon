import {
  applyExperience,
  calculateBattleExp,
  calculateGoldReward,
  calculateMonsterStats,
  rollEvolutionItemReward,
  rollItemReward,
  sumCreaturePower,
  type RoundResult,
} from "@chainmon/game-engine";
import { getSpeciesById } from "@chainmon/monster-data";
import type {
  BattleRewardSettlement,
  RewardSettleContext,
} from "@/lib/data";

/**
 * Pure reward computation executed ONCE inside the battle-completion
 * transaction (see repository.submitRound → applyRewards).
 *
 * - Gold: server-computed from the opponent team power + winner.
 * - EXP: every participating team monster (3) gains the same base EXP.
 * - Item drop: rolled server-side via the injected RandomSource.
 * - Level up / stat recalculation / skill unlock happen atomically with
 *   the storage writes via the RewardSettleContext primitives.
 */
export async function computeBattleRewards(
  ctx: RewardSettleContext,
  round: RoundResult,
): Promise<BattleRewardSettlement> {
  const state = round.state;
  const winner = state.winner;
  if (!winner) {
    throw new Error("progression: cannot settle rewards without a winner");
  }
  const victory = winner === "player";

  const opponentPower = sumCreaturePower(state.opponentTeam);

  // Gold
  const gold = calculateGoldReward(opponentPower, victory);
  await ctx.addGold(gold);

  // EXP (all 3 participating monsters equally)
  const expGained = calculateBattleExp(opponentPower, victory);
  const monsters: BattleRewardSettlement["monsters"] = [];

  for (const creature of state.playerTeam) {
    if (!creature.sourceMonsterId) continue;
    const view = await ctx.getMonster(creature.sourceMonsterId);
    if (!view) continue;
    const species = getSpeciesById(view.speciesId);
    if (!species) continue;

    const applied = applyExperience(view.level, view.exp, expGained);
    const stats = calculateMonsterStats(species, view.dna, applied.newLevel);

    let unlockedSkills: string[] = [];
    if (applied.newLevel > applied.oldLevel) {
      const candidates = species.learnableSkills
        .filter(
          (entry) =>
            entry.unlockLevel > applied.oldLevel &&
            entry.unlockLevel <= applied.newLevel,
        )
        .map((entry) => entry.skillId);
      const notOwned = candidates.filter((id) => !view.skills.includes(id));
      if (notOwned.length > 0) {
        unlockedSkills = await ctx.addMonsterSkills(view.id, notOwned);
      }
    }

    await ctx.setMonsterStats(view.id, {
      level: applied.newLevel,
      exp: applied.newExp,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
    });

    monsters.push({
      monsterId: view.id,
      expGained,
      oldLevel: applied.oldLevel,
      newLevel: applied.newLevel,
      oldExp: applied.oldExp,
      newExp: applied.newExp,
      unlockedSkills,
    });
  }

  // Item drop (Pixel World Upgrade: ball drops + legacy evolution stone)
  const items: BattleRewardSettlement["items"] = [];
  const drop = rollItemReward(winner);
  if (drop) {
    await ctx.addInventory(drop.itemSlug, drop.quantity);
    items.push(drop);
  }
  const stoneDrop = rollEvolutionItemReward(victory);
  if (stoneDrop) {
    await ctx.addInventory(stoneDrop.itemSlug, stoneDrop.quantity);
    items.push(stoneDrop);
  }

  return { gold, monsters, items };
}
