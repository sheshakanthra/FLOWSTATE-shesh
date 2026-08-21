import { cn } from "@/lib/utils";

const WIDTH = 64;
const HEIGHT = 20;

export interface SparklineProps {
  values: number[];
  className?: string;
}

/**
 * Session spec item 6: "Sparkline each. Static data from rollups -- no
 * interactive charts in this slice." A plain inline `<svg>` polyline, not
 * Recharts (CLAUDE.md's own stack table reserves Recharts, lazy-imported,
 * for real interactive charts elsewhere in the product -- pulling it in
 * for a non-interactive 64x20px decoration would be the exact kind of
 * unrequested dependency weight this session's own "no interactive
 * charts" line is warning against). `currentColor` + a Tailwind text-color
 * class, never a literal, so the color-literal ESLint rule still governs
 * this the same as everywhere else.
 */
export function Sparkline({ values, className }: SparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? WIDTH / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = HEIGHT - ((value - min) / range) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("overflow-visible text-fg-200", className)}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
