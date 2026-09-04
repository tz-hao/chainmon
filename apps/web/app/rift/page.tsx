import { RiftExperience } from "@/components/rift/RiftExperience";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

export default async function RiftPage() {
  const { repository, trainer } = await requirePageTrainer();
  const [collection, inventory, team] = await Promise.all([
    repository.listMonsters(trainer.id),
    repository.getInventory(trainer.id),
    repository.getTeam(trainer.id),
  ]);
  const monsters = collection.map((monster) => ({
    id: monster.id,
    speciesId: monster.speciesId,
    name: monster.name,
    element: monster.element,
    rarity: monster.rarity,
    level: monster.level,
    hp: monster.hp,
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed,
  }));

  return (
    <RiftExperience
      trainer={trainer}
      monsters={monsters}
      inventory={inventory}
      initialTeamIds={team?.map((monster) => monster.id) ?? []}
    />
  );
}
