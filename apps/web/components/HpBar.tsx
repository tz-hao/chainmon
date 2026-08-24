interface HpBarProps {
  current: number;
  max: number;
}

export function HpBar({ current, max }: HpBarProps) {
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((current / Math.max(max, 1)) * 100)),
  );
  const color =
    percentage > 50
      ? "from-emerald-500 to-green-400"
      : percentage > 20
        ? "from-yellow-500 to-amber-400"
        : "from-red-500 to-rose-400";

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
