"use client";

import { Check } from "lucide-react";
import { POST_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusStepperProps {
  status: string;
}

// Highlights the current step across the POST_STATUS lifecycle
// (idea → draft → approved → posted → analyzed).
export function StatusStepper({ status }: StatusStepperProps) {
  const currentIndex = POST_STATUS.indexOf(
    status as (typeof POST_STATUS)[number],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {POST_STATUS.map((s, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary/40 bg-primary/10 text-primary",
                !active &&
                  !done &&
                  "border-input text-muted-foreground",
              )}
            >
              {done && <Check className="size-3" />}
              {s}
            </div>
            {i < POST_STATUS.length - 1 && (
              <span className="text-muted-foreground">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
