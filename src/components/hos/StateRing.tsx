export function StateRing({
  value,
  size = 56,
  stroke = 4,
  inverse = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  inverse?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const display = inverse ? 100 - clamped : clamped;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (display / 100) * c;

  const tone =
    display >= 75
      ? "var(--color-success)"
      : display >= 50
        ? "var(--color-primary)"
        : display >= 30
          ? "var(--color-warning)"
          : "var(--color-destructive)";

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke="var(--color-hairline)"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        stroke={tone}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        fill="none"
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  );
}
