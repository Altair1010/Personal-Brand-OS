"use client";

import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RevisionDiffProps {
  currentRatio: Record<string, number>;
  revisedRatio: Record<string, number>;
  reason: string;
}

function fmt(v: number | undefined): string {
  return v === undefined ? "—" : `${v}%`;
}

export function RevisionDiff({
  currentRatio,
  revisedRatio,
  reason,
}: RevisionDiffProps) {
  // Union key — pillar có thể bị bỏ hoặc thêm mới.
  const keys = Array.from(
    new Set([...Object.keys(currentRatio), ...Object.keys(revisedRatio)]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Thay đổi tỉ trọng pillar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y rounded-lg border">
          {keys.map((key) => {
            const oldV = currentRatio[key];
            const newV = revisedRatio[key];
            const delta = (newV ?? 0) - (oldV ?? 0);
            const up = delta > 0;
            const down = delta < 0;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {key}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{fmt(oldV)}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span
                    className={
                      up
                        ? "font-semibold text-emerald-600"
                        : down
                          ? "font-semibold text-rose-600"
                          : "font-medium text-foreground"
                    }
                  >
                    {fmt(newV)}
                  </span>
                  {up ? (
                    <TrendingUp className="size-4 text-emerald-600" />
                  ) : down ? (
                    <TrendingDown className="size-4 text-rose-600" />
                  ) : (
                    <Minus className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase text-amber-800">
            Lý do chốt version mới
          </p>
          <p className="mt-1 text-sm text-amber-900">{reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}
