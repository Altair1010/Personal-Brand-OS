"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Layers3 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  listFacebookAccounts,
  type FacebookAccountDTO,
} from "@/app/(dashboard)/performance/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFacebookStore } from "@/lib/stores/facebook";

function FacebookMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={[
        "relative grid shrink-0 place-items-center rounded-full bg-[var(--neu-teal)] text-[hsl(var(--primary-foreground))]",
        "[box-shadow:inset_-1px_-1px_2px_rgba(255,255,255,.16),var(--shadow-raised-sm)]",
        compact ? "size-7" : "size-8",
      ].join(" ")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={compact ? "size-4" : "size-[18px]"} role="img">
        <path
          fill="currentColor"
          d="M13.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6H17V3.8c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5V10H7v3h3v8h3.5Z"
        />
      </svg>
      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-[var(--neu-raised)] bg-[#5A8581]" />
    </span>
  );
}

export function AccountSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = useFacebookStore((state) => state.activeFacebookAccountId);
  const setActive = useFacebookStore((state) => state.setActiveFacebookAccount);
  const [accounts, setAccounts] = useState<FacebookAccountDTO[]>([]);
  const [switching, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listFacebookAccounts()
      .then((list) => {
        if (active) setAccounts(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("fb");
    if (fromUrl !== activeId) setActive(fromUrl);
  }, [searchParams, activeId, setActive]);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeId) ?? null,
    [accounts, activeId],
  );

  if (accounts.length === 0) return null;

  function switchAccount(id: string | null) {
    setActive(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("fb", id);
    else params.delete("fb");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const currentName = activeAccount?.pageName ?? "Tất cả Facebook Page";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          className={[
            "group relative flex h-10 w-[248px] max-w-[28vw] items-center gap-2.5 overflow-hidden rounded-xl",
            "border border-white/30 bg-[var(--neu-inset)] px-2.5 text-left",
            "[box-shadow:var(--shadow-inset)] transition-[box-shadow,background-color,border-color] duration-150",
            "hover:border-[rgba(12,79,84,.25)] hover:bg-[var(--neu-raised)] hover:[box-shadow:var(--shadow-raised-sm)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-wait disabled:opacity-60",
          ].join(" ")}
          aria-label="Đổi Facebook Page đang quản trị"
          title="Đổi Facebook Page đang quản trị"
        >
          <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[var(--neu-teal)] opacity-90" />
          <FacebookMark compact />

          <span className="min-w-0 flex-1 leading-none">
            <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--neu-teal)]/75">
              Page đang quản trị
            </span>
            <span className="mt-1 block truncate text-[12px] font-semibold text-foreground">
              {currentName}
            </span>
          </span>

          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[rgba(12,79,84,.07)] text-[var(--neu-teal)] transition-colors group-hover:bg-[var(--neu-teal-soft)]">
            <ChevronDown className="size-3.5" />
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        sideOffset={8}
        className="w-[290px] rounded-2xl p-2"
      >
        <div className="mb-1.5 flex items-center gap-2 px-2 py-1.5">
          <FacebookMark compact />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--neu-teal)]">
              Facebook Page Scope
            </div>
            <div className="text-[11px] text-muted-foreground">
              Chọn Page để đổi toàn bộ ngữ cảnh quản trị
            </div>
          </div>
        </div>

        <DropdownMenuItem
          onSelect={() => switchAccount(null)}
          className="group flex min-h-11 items-center gap-2.5 rounded-xl px-2.5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgba(12,79,84,.07)] text-[var(--neu-teal)]">
            <Layers3 className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Tất cả Facebook Page</span>
            <span className="block text-[10px] text-muted-foreground">Xem dữ liệu tổng hợp</span>
          </span>
          {!activeId && <Check className="size-4 text-[var(--neu-teal)]" />}
        </DropdownMenuItem>

        <div className="my-1.5 h-px bg-[rgba(12,79,84,.10)]" />

        {accounts.map((account) => {
          const selected = account.id === activeId;
          return (
            <DropdownMenuItem
              key={account.id}
              onSelect={() => switchAccount(account.id)}
              className={[
                "group flex min-h-11 items-center gap-2.5 rounded-xl px-2.5",
                selected ? "bg-[var(--neu-teal-soft)] text-[var(--neu-teal)]" : "",
              ].join(" ")}
            >
              <FacebookMark compact />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{account.pageName}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {selected ? "Đang quản trị" : "Chuyển sang Page này"}
                </span>
              </span>
              {selected && <Check className="size-4 shrink-0 text-[var(--neu-teal)]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
