interface MetricBarProps {
  value: number;
  warning?: number;
  danger?: number;
}

export default function MetricBar({ value, warning = 70, danger = 90 }: MetricBarProps) {
  const color =
    value >= danger
      ? "bg-red-500"
      : value >= warning
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
