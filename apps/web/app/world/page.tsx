import { PixelWorld } from "@/components/world/PixelWorld";
import { requirePageTrainer } from "@/lib/auth/current-trainer";

export const dynamic = "force-dynamic";

/** /world — the Phaser Pixel World (ChainMon Valley). */
export default async function WorldPage() {
  await requirePageTrainer();
  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <PixelWorld />
    </main>
  );
}
