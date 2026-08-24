/**
 * ChainMon — placeholder monster art generator (Phase 2).
 * Writes one SVG per species into apps/web/public/monsters/.
 * No copyrighted art: simple gradient + emoji placeholders.
 *
 * Run: node scripts/generate-placeholder-art.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "web", "public", "monsters");

const ELEMENT_COLORS = {
  fire: ["#7f1d1d", "#f97316"],
  water: ["#1e3a8a", "#0ea5e9"],
  nature: ["#14532d", "#22c55e"],
  electric: ["#422006", "#eab308"],
};

const ART = [
  ["firecub", "fire", "🐾"],
  ["firewolf", "fire", "🐺"],
  ["infernowolf", "fire", "🌋"],
  ["emberfox", "fire", "🦊"],
  ["magmaboar", "fire", "🐗"],
  ["aquaturtle", "water", "🐢"],
  ["bubblefin", "water", "🐠"],
  ["tideotter", "water", "🦦"],
  ["coralserpent", "water", "🐍"],
  ["abyssshark", "water", "🦈"],
  ["leafcat", "nature", "🐈"],
  ["bloommantis", "nature", "🦗"],
  ["mossbear", "nature", "🐻"],
  ["thorndeer", "nature", "🦌"],
  ["ancienttreant", "nature", "🌳"],
  ["sparkmouse", "electric", "🐭"],
  ["staticlynx", "electric", "🐆"],
  ["volthare", "electric", "🐇"],
  ["stormdragon", "electric", "🐉"],
  ["thunderbird", "electric", "🦅"],
];

function svgFor(slug, element, emoji) {
  const [c1, c2] = ELEMENT_COLORS[element];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="56" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="168" fill="rgba(255,255,255,0.10)"/>
  <circle cx="256" cy="256" r="120" fill="rgba(0,0,0,0.18)"/>
  <text x="256" y="268" font-size="150" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });

let count = 0;
for (const [slug, element, emoji] of ART) {
  const file = join(outDir, `${slug}.svg`);
  writeFileSync(file, svgFor(slug, element, emoji), "utf8");
  count += 1;
}

// Generic fallback for unknown species
writeFileSync(
  join(outDir, "placeholder.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="56" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="168" fill="rgba(255,255,255,0.10)"/>
  <text x="256" y="268" font-size="150" text-anchor="middle" dominant-baseline="middle">⛓️</text>
</svg>
`,
  "utf8",
);

console.log(`Wrote ${count + 1} placeholder SVGs to ${outDir}`);
