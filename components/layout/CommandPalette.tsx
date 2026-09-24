"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, CalendarDays, FlaskConical, Gauge, Megaphone, Search, Settings,
  Sparkles, SquarePen, Target, UsersRound, X,
} from "lucide-react";


const actions = [
  { label: "Command Center", href: "/", icon: Gauge, keywords: "home dashboard today" },
  { label: "Strategy", href: "/strategy", icon: Target, keywords: "plan strategy" },
  { label: "Create content", href: "/studio", icon: SquarePen, keywords: "studio content draft write" },
  { label: "Create campaign", href: "/campaigns", icon: Megaphone, keywords: "campaign imc" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "schedule publish" },
  { label: "Performance", href: "/performance", icon: Sparkles, keywords: "analytics metrics" },
  { label: "Experiments", href: "/experiments", icon: FlaskConical, keywords: "test ab experiment" },
  { label: "Agents", href: "/agents", icon: Bot, keywords: "agent thread run prompt skill" },
  { label: "Knowledge", href: "/knowledge", icon: UsersRound, keywords: "evidence context knowledge" },
  { label: "Settings", href: "/settings", icon: Settings, keywords: "model tools config" },
] as const;

type SearchResult = {
  kind: string;
  id: string;
  label: string;
  meta?: string | null;
  href: string;
};

type PaletteItem =
  | { type: "action"; key: string; label: string; href: string; meta: string; icon: typeof Gauge }
  | { type: "search"; key: string; label: string; href: string; meta: string; icon: typeof Search }
  | { type: "agent"; key: string; label: string; href: ""; meta: string; icon: typeof Bot };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else {
      setQuery("");
      setRemote([]);
      setActiveIndex(0);
    }
  }, [open]);

  const local = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/vnext/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await res.json();
        setRemote(res.ok && body?.ok && Array.isArray(body.data) ? body.data : []);
      } catch {
        if (!controller.signal.aborted) setRemote([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = useMemo<PaletteItem[]>(() => {
    const seen = new Set<string>();
    const result: PaletteItem[] = [];
    for (const item of local) {
      seen.add(item.href);
      result.push({
        type: "action",
        key: `action:${item.href}`,
        label: item.label,
        href: item.href,
        meta: item.href,
        icon: item.icon,
      });
    }
    for (const item of remote) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      result.push({
        type: "search",
        key: `${item.kind}:${item.id}`,
        label: item.label,
        href: item.href,
        meta: [item.kind, item.meta].filter(Boolean).join(" · "),
        icon: Search,
      });
    }
    result.push({
      type: "agent",
      key: "agent:global",
      label: "Ask Piltover Agent",
      href: "",
      meta: "global agent dock",
      icon: Bot,
    });
    return result.slice(0, 30);
  }, [local, remote]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, remote.length]);

  function activate(item: PaletteItem) {
    setOpen(false);
    if (item.type === "agent") {
      window.dispatchEvent(new CustomEvent("piltover:open-agent"));
      return;
    }
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(items.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      activate(items[activeIndex]);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, items.length - 1));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-[rgba(68,61,50,.34)] p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div
        className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/30 bg-popover [box-shadow:var(--shadow-popover)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Piltover command palette"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search commands, campaigns, content, threads, experiments, evidence…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="piltover-command-results"
            aria-activedescendant={items[activeIndex] ? `command-item-${activeIndex}` : undefined}
          />
          {loading && <span className="text-[10px] text-muted-foreground">searching</span>}
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
          <button onClick={() => setOpen(false)} aria-label="Close command palette">
            <X className="size-4" />
          </button>
        </div>

        <div id="piltover-command-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = index === activeIndex;
            return (
              <button
                id={`command-item-${index}`}
                role="option"
                aria-selected={active}
                key={item.key}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activate(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">{item.meta}</span>
              </button>
            );
          })}
          {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching command or artifact.</p>}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
          <span>↑ ↓ navigate · Enter open · Esc close</span>
          <span>{remote.length ? `${remote.length} workspace results` : "workspace search"}</span>
        </div>
      </div>
    </div>
  );
}
