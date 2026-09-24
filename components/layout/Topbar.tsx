"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Cpu, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const label = getBreadcrumb(pathname);
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
      {/* Left: current Piltover surface. */}
      <nav aria-label="breadcrumb" className="min-w-0 max-w-full justify-self-start overflow-hidden">
        <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm">
          <li className="hidden text-muted-foreground sm:list-item">Piltover</li>
          <li className="hidden text-muted-foreground sm:list-item">/</li>
          <li className="truncate font-medium text-foreground">{label}</li>
        </ol>
      </nav>

      {/* Center: Page Switcher stays between breadcrumb and the right-side controls. */}
      <div className="pointer-events-auto min-w-0 justify-self-center">
        <AccountSwitcher />
      </div>

      {/* Right: theme -> model -> account -> logout. */}
      <div className="flex min-w-0 items-center justify-self-end gap-1.5">
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

        <Badge variant="outline" className="flex items-center gap-1.5 text-xs text-[var(--neu-teal)]">
          <Cpu className="h-3 w-3" />
          <span className="hidden xl:inline">Model AI</span>
        </Badge>

        {email && (
          <div className="flex min-w-0 items-center gap-1.5 border-l border-white/20 pl-2">
            <span
              className="hidden max-w-[180px] truncate text-xs text-muted-foreground lg:inline"
              title={email}
            >
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
              <span className="hidden xl:inline">Đăng xuất</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
