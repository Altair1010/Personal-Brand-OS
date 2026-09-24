"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SoftSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function SoftSelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled,
  className,
  ariaLabel,
}: {
  value: string;
  options: SoftSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input",
            "bg-[var(--neu-inset)] px-3 text-left text-sm [box-shadow:var(--shadow-inset)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-[var(--neu-teal)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[360px] rounded-xl p-1.5"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value || "__empty__"}
              onSelect={() => onChange(option.value)}
              className={cn(
                "min-h-10 rounded-lg px-2.5 py-2",
                active && "bg-[var(--neu-teal-soft)] text-[var(--neu-teal)]",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
              {active && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
