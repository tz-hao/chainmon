import { getSkillById, MONSTER_SPECIES } from "@chainmon/monster-data";

interface KnowledgeCardProps {
  skillIds: readonly string[];
}

/**
 * Web3 Knowledge panel — for monsters with knowledge-bearing skills.
 * Shows concept title + 1-3 sentence explanation (not a tutorial wall).
 */
export function KnowledgeCard({ skillIds }: KnowledgeCardProps) {
  const entries = skillIds
    .map((id) => getSkillById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s?.knowledgeTitle));

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
        <span className="text-base">📚</span> Web3 Knowledge
      </h2>
      <div className="space-y-3">
        {entries.map((skill) => (
          <div
            key={skill.id}
            className="rounded-xl border border-purple-500/20 bg-slate-900/60 p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
              {skill.knowledgeTitle}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              via {skill.name}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {skill.knowledgeSummary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Knowledge Dex entries derive directly from the canonical species + skills. */
export const WEB3_CONCEPTS = MONSTER_SPECIES.flatMap((species) =>
  species.learnableSkills
    .map((entry) => getSkillById(entry.skillId))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill?.knowledgeTitle))
    .map((skill) => ({
      id: skill.id,
      title: skill.knowledgeTitle!,
      summary: skill.knowledgeSummary ?? skill.description ?? "",
      monster: species.name,
      speciesId: species.id,
    })),
);

export interface KnowledgeUnlock {
  conceptId: string;
  unlocked: boolean;
}

/** Which concepts a trainer unlocked (captured Web3 monsters). */
export function unlockedConcepts(
  ownedSpeciesIds: readonly number[],
  ownedSkills: readonly { id: string; name: string }[],
): Set<string> {
  const unlocked = new Set<string>();
  for (const concept of WEB3_CONCEPTS) {
    if (ownedSpeciesIds.includes(concept.speciesId)) unlocked.add(concept.id);
  }
  // Also unlock via directly learned knowledge skills.
  for (const skill of ownedSkills) {
    const full = getSkillById(skill.id);
    if (full?.knowledgeTitle) {
      unlocked.add(full.id);
    }
  }
  return unlocked;
}
