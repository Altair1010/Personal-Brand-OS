"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bot, BrainCircuit, CalendarDays, ChevronLeft, ChevronRight,
  ClipboardCheck, FlaskConical, Gauge, Map, Megaphone, Settings, SquarePen, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Operate",
    items: [
      { label: "Onboarding", href: "/onboarding", icon: UserCheck },
      { label: "Strategy", href: "/strategy", icon: Map },
      { label: "Studio", href: "/studio", icon: SquarePen },
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Learn",
    items: [
      { label: "Performance", href: "/performance", icon: BarChart3 },
      { label: "Experiments", href: "/experiments", icon: FlaskConical },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Knowledge", href: "/knowledge", icon: BrainCircuit },
      { label: "Review", href: "/review", icon: ClipboardCheck },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Command Center", href: "/", icon: Gauge },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const facebookScope = searchParams.get("fb");
  const scopedHref = (href: string) =>
    facebookScope ? `${href}?fb=${encodeURIComponent(facebookScope)}` : href;

  useEffect(() => {
    for (const group of GROUPS) {
      for (const item of group.items) router.prefetch(scopedHref(item.href));
    }
  }, [router, facebookScope]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-white/20 bg-[var(--neu-raised)] [box-shadow:6px_0_16px_rgba(124,108,87,.16)] transition-[width] duration-200",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden border-b border-white/20",
          collapsed ? "h-14" : "h-24",
        )}
        aria-label="Piltover"
      >
        <img
          src="/brand/sidebar-hero.webp"
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover object-[50%_34%]",
            collapsed && "scale-125",
          )}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[32%] bg-gradient-to-r from-[var(--neu-raised)] via-[color:var(--neu-raised)]/55 to-transparent backdrop-blur-[2px]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[32%] bg-gradient-to-l from-[var(--neu-raised)] via-[color:var(--neu-raised)]/55 to-transparent backdrop-blur-[2px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[var(--neu-raised)] to-transparent" />
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-1.5" : "px-2")}>
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
            )}
            {collapsed && <div className="mx-auto my-2 w-7 border-t border-[rgba(12,79,84,.12)]" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={scopedHref(item.href)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-[13px] transition-[background-color,color,box-shadow] duration-150",
                    collapsed
                      ? "mx-auto aspect-square size-10 justify-center p-0"
                      : "h-9 gap-2.5 px-2",
                    isActive(item.href)
                      ? "bg-[var(--neu-teal-soft)] text-[var(--neu-teal)] [box-shadow:var(--shadow-pressed)]"
                      : "text-muted-foreground hover:bg-[rgba(12,79,84,.07)] hover:text-[var(--neu-teal)]",
                  )}
                >
                  <item.icon className={cn("shrink-0", collapsed ? "size-[18px]" : "size-4")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Command palette</span>
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Ctrl K</kbd>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="absolute -right-3 top-16 z-10 grid size-6 place-items-center rounded-full border border-white/25 bg-[var(--neu-raised)] text-muted-foreground [box-shadow:var(--shadow-raised-sm)] hover:text-[var(--neu-teal)] active:[box-shadow:var(--shadow-pressed)]"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
      </button>
    </aside>
  );
}
