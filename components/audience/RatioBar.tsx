"use client";

import { normalizeWeightsTo100 } from "@/lib/strategy-engine/normalizeRatio";

// Display-only ratio bar. Segment widths are re-normalized to sum EXACTLY 100 so the
// preview always matches what the server will persist (never trust raw input sums).

const COLORS = [
  "bg-[#0C4F54]",
  "bg-[#2D6A6D]",
  "bg-[#5A8581]",
  "bg-[#B58D55]",
  "bg-[#8C7A64]",
];

interface RatioBarProps {
  segments: { label: string; weight: number }[];
}

export function RatioBar({ segments }: RatioBarProps) {
  const normalized = normalizeWeightsTo100(segments.map((s) => s.weight));
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {normalized.map((pct, i) => (
          <div
            key={i}
            className={COLORS[i % COLORS.length]}
            style={{ width: `${pct}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-2 rounded-full ${COLORS[i % COLORS.length]}`}
            />
            {s.label}: {normalized[i]}%
          </span>
        ))}
      </div>
    </div>
  );
}
