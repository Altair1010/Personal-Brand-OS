"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Map,
  PenSquare,
  CalendarDays,
  BarChart2,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Studio + Calendar share ONE nav group
const NAV_ITEMS = [
  {
    label: "Bảng điều khiển",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Onboarding",
    href: "/onboarding",
    icon: UserCheck,
  },
  {
    label: "Khán giả & Trụ cột",
    href: "/audience-pillars",
    icon: Users,
  },
  {
    label: "Chiến lược",
    href: "/strategy",
    icon: Map,
  },
  {
    label: "Studio & Lịch",
    href: null, // group header — not a link
    icon: null,
    children: [
      { label: "Studio", href: "/studio", icon: PenSquare },
      { label: "Lịch", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Hiệu suất",
    href: "/performance",
    icon: BarChart2,
  },
  {
    label: "Đánh giá tuần",
    href: "/review",
    icon: ClipboardList,
  },
  {
    label: "Cài đặt",
    href: "/settings",
    icon: Settings,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-slate-50 transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-3">
        {!collapsed && (
          <span className="font-semibold text-sm text-primary truncate">
            Personal Brand OS
          </span>
        )}
        {collapsed && (
          <span className="mx-auto text-lg font-bold text-primary">P</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          // Group (Studio & Calendar)
          if ("children" in item && item.children) {
            return (
              <div key={item.label}>
                {!collapsed && (
                  <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                )}
                {collapsed && <div className="border-t my-1" />}
                {item.children.map((child) => (
                  <NavLink
                    key={child.href}
                    href={child.href}
                    label={child.label}
                    icon={child.icon}
                    active={isActive(child.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            );
          }

          // Regular item
          if (!item.href) return null;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon!}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}

function NavLink({ href, label, icon: Icon, active, collapsed }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
