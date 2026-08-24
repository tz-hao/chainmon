import { ELEMENT_LABELS, type Element } from "@chainmon/shared";

const ELEMENT_STYLES: Record<Element, string> = {
  fire: "bg-red-500/15 text-red-400 ring-red-500/30",
  water: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  nature: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  electric: "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30",
};

export function ElementBadge({ element }: { element: Element }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ELEMENT_STYLES[element]}`}
    >
      {ELEMENT_LABELS[element]}
    </span>
  );
}
