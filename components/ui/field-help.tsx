"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Small "?" help affordance: a round icon button that reveals `text` in a tooltip
// on hover/focus. Self-contained (wraps its own provider) so it works standalone.
export function FieldHelp({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Trợ giúp"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Drop-in replacement for <Label htmlFor>. When `help` is provided, renders an
// inline FieldHelp icon next to the label text.
export function LabelWithHelp({
  htmlFor,
  children,
  help,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor}>{children}</Label>
      {help ? <FieldHelp text={help} /> : null}
    </div>
  );
}
