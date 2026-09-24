"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cpu, Plus, LogOut, CalendarRange, Users, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getSupabaseClient } from "@/lib/supabase";
import { useTheme } from "@/components/Providers";
import { AccountSwitcher } from "./AccountSwitcher";

const BREADCRUMB_MAP: Record<string, string> = {
  "/": "Command Center",
  "/onboarding": "Onboarding",
  "/audience-pillars": "Audience & Pillars",
  "/strategy": "Strategy",
  "/studio": "Studio",
  "/calendar": "Calendar",
  "/performance": "Performance",
  "/experiments": "Experiments",
  "/agents": "Agents",
  "/knowledge": "Knowledge",
  "/review": "Review",
  "/settings": "Settings",
};

function getBreadcrumb(pathname: string): string {
  if (pathname === "/") return BREADCRUMB_MAP["/"];
  const key = Object.keys(BREADCRUMB_MAP)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? BREADCRUMB_MAP[key] : pathname;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const label = getBreadcrumb(pathname);
  const withScope = (href: string) => {
    const fb = searchParams.get("fb");
    return fb ? `${href}?fb=${encodeURIComponent(fb)}` : href;
  };
  const [email, setEmail] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  useEffect(() => {
    let active = true;
    getSupabaseClient()
      .then(async (supabase) => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (active) setEmail(session?.user.email ?? null);
      })
      .catch(() => {
        /* unconfigured — AuthGate surfaces it */
      });
    return () => {
      active = false;
    };
  }, []);

  async function onLogout() {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    // AuthGate's onAuthStateChange handles the redirect to /login.
  }

  return (
    <header className="relative grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-white/20 bg-[var(--neu-raised)] px-3 [box-shadow:0_5px_14px_rgba(124,108,87,.12)] sm:gap-3 sm:px-5">
      {/* Left edge: theme is the stable primary control. Secondary actions collapse first. */}
      <div className="flex min-w-0 items-center justify-self-start gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={toggleTheme}
          aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Badge variant="outline" className="flex items-center gap-1.5 text-xs text-[var(--neu-teal)]">
            <Cpu className="h-3 w-3" />
            <span className="hidden 2xl:inline">Model AI</span>
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Tạo mới</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => router.push(withScope("/strategy"))}>
                <CalendarRange className="h-3.5 w-3.5" />
                Chiến lược mới
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push(withScope("/audience-pillars"))}>
                <Users className="h-3.5 w-3.5" />
                Thêm persona
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {email && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-2">
              <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground 2xl:inline">
                {email}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={onLogout}
                title="Đăng xuất"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden 2xl:inline">Đăng xuất</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* True center: independent from unequal edge-group widths. */}
      <div className="pointer-events-auto min-w-0 justify-self-center">
        <AccountSwitcher />
      </div>

      {/* Right edge: current Piltover surface. */}
      <nav aria-label="breadcrumb" className="min-w-0 max-w-full justify-self-end overflow-hidden text-right">
        <ol className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden text-sm">
          <li className="hidden text-muted-foreground sm:list-item">Piltover</li>
          <li className="hidden text-muted-foreground sm:list-item">/</li>
          <li className="truncate font-medium text-foreground">{label}</li>
        </ol>
      </nav>
    </header>
  );
}
