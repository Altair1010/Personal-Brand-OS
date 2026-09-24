import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-[background-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-white/15 bg-primary text-primary-foreground [box-shadow:var(--shadow-raised-sm)]",
        secondary:
          "border-white/25 bg-secondary text-secondary-foreground [box-shadow:var(--shadow-raised-sm)]",
        destructive:
          "border-white/15 bg-destructive text-destructive-foreground [box-shadow:var(--shadow-raised-sm)]",
        outline:
          "border-white/25 bg-[var(--neu-raised)] text-foreground [box-shadow:var(--shadow-raised-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
