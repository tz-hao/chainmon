import Image from "next/image";
import {
  getMonsterVisualPath,
  getVisualBySpeciesId,
  MONSTER_VISUAL_DIMENSIONS,
  type MonsterVisualKind,
} from "@/lib/world/monster-visuals";

export type PixelScale = 1 | 2 | 3;

interface PixelMonsterProps {
  speciesId: number;
  alt: string;
  variant?: MonsterVisualKind;
  scale?: PixelScale;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}

/**
 * The only image primitive for canonical ChainMon species art. Native source
 * dimensions are multiplied by an integer and Next's optimizer is disabled so
 * pixel edges remain sharp in every route.
 */
export function PixelMonster({
  speciesId,
  alt,
  variant = "portrait",
  scale = 1,
  className,
  priority = false,
  decorative = false,
}: PixelMonsterProps) {
  const visual = getVisualBySpeciesId(speciesId);
  const dimension = MONSTER_VISUAL_DIMENSIONS[variant] * scale;

  return (
    <Image
      src={getMonsterVisualPath(speciesId, variant)}
      alt={decorative ? "" : alt}
      width={dimension}
      height={dimension}
      unoptimized
      priority={priority}
      className={`shrink-0 object-contain [image-rendering:pixelated] ${className ?? ""}`}
      style={{ imageRendering: visual.pixelRenderingMode }}
    />
  );
}
