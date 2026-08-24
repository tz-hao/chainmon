import { PixelWorld } from "@/components/world/PixelWorld";

export const dynamic = "force-dynamic";

/** /world — the Phaser Pixel World (ChainMon Valley). */
export default async function WorldPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950">
      <PixelWorld />
    </main>
  );
}
