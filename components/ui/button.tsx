import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-white/15 bg-primary text-primary-foreground [box-shadow:var(--shadow-raised-sm)] hover:bg-[var(--neu-teal-hover)] active:[box-shadow:var(--shadow-pressed)]",
        destructive:
          "border border-white/15 bg-destructive text-destructive-foreground [box-shadow:var(--shadow-raised-sm)] hover:brightness-95 active:[box-shadow:var(--shadow-pressed)]",
        outline:
          "border border-white/25 bg-[var(--neu-raised)] text-foreground [box-shadow:var(--shadow-raised-sm)] hover:bg-[var(--neu-teal-soft)] hover:text-[var(--neu-teal)] active:[box-shadow:var(--shadow-pressed)]",
        secondary:
          "border border-white/25 bg-secondary text-secondary-foreground [box-shadow:var(--shadow-raised-sm)] hover:bg-[var(--neu-teal-soft)] active:[box-shadow:var(--shadow-pressed)]",
        ghost:
          "border border-transparent text-foreground hover:bg-[rgba(12,79,84,.08)] hover:text-[var(--neu-teal)] active:[box-shadow:var(--shadow-pressed)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
