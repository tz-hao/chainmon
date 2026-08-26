import { requirePageTrainer } from "@/lib/auth/current-trainer";
import { WorldSelect } from "@/components/world/WorldSelect";
import { normalizeWorldMapId } from "@/lib/world/world-maps";

export const dynamic = "force-dynamic";

export default async function WorldSelectPage() {
  const { repository, trainer } = await requirePageTrainer();
  const position = await repository.getTrainerWorldPosition(trainer.id);
  return (
    <main className="min-h-screen bg-slate-950">
      <WorldSelect currentWorldMap={normalizeWorldMapId(position?.worldMap)} />
    </main>
  );
}
