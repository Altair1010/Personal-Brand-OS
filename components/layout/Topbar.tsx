"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cpu, Plus, LogOut, FileText, CalendarRange, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getSupabaseClient } from "@/lib/supabase";
import { createBlankDraft } from "@/app/(dashboard)/studio/actions";
import { AccountSwitcher } from "./AccountSwitcher";

const BREADCRUMB_MAP: Record<string, string> = {
  "/": "Bảng điều khiển",
  "/onboarding": "Onboarding",
  "/audience-pillars": "Khán giả & Trụ cột",
  "/strategy": "Chiến lược",
  "/studio": "Studio",
  "/calendar": "Lịch",
  "/performance": "Hiệu suất",
  "/review": "Đánh giá tuần",
  "/settings": "Cài đặt",
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
  const label = getBreadcrumb(pathname);
  const [email, setEmail] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  function onNewDraft() {
    startCreate(async () => {
      const res = await createBlankDraft();
      if (res.ok) router.push(`/studio/${res.data.draftId}`);
    });
  }

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
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="text-muted-foreground">Personal Brand OS</li>
          <li className="text-muted-foreground">/</li>
          <li className="font-medium text-foreground">{label}</li>
        </ol>
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Facebook page scope switcher */}
        <AccountSwitcher />

        {/* AI model chip — placeholder, no logic */}
        <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
          <Cpu className="h-3 w-3" />
          <span>Model AI</span>
        </Badge>

        {/* Quick action */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5" disabled={creating}>
              <Plus className="h-3.5 w-3.5" />
              Tạo mới
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onNewDraft}>
              <FileText className="h-3.5 w-3.5" />
              Bản nháp mới
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/strategy")}>
              <CalendarRange className="h-3.5 w-3.5" />
              Chiến lược mới
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/audience-pillars")}>
              <Users className="h-3.5 w-3.5" />
              Thêm persona
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account */}
        {email && (
          <div className="flex items-center gap-2 border-l pl-3">
            <span className="max-w-[180px] truncate text-xs text-muted-foreground">
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
              Đăng xuất
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
