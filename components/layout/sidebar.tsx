"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  SearchCheck,
  X,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "대시보드",    href: "/dashboard"    },
  { icon: Car,             label: "신차 배분",   href: "/allocation"   },
  { icon: SearchCheck,     label: "워크스페이스", href: "/work-history" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 border border-border/70 bg-white/80 shadow-[0_12px_30px_-20px_rgba(20,26,36,0.45)] backdrop-blur md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#141A24]/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-all duration-300",
          "hidden md:flex",
          collapsed ? "w-20" : "w-72",
          mobileOpen && "!fixed inset-y-0 left-0 z-50 !flex w-72"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0078FF] text-white shadow-[0_16px_30px_-18px_rgba(0,120,255,0.95)]">
                <CarFront className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  SOCAR
                </p>
                <span className="block truncate text-base font-semibold text-sidebar-foreground">
                  Workspace Hub
                </span>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_12px_26px_-22px_rgba(0,120,255,0.8)] ring-1 ring-[#0078FF]/10"
                    : "text-muted-foreground hover:bg-white/60 hover:text-sidebar-foreground dark:hover:bg-white/5"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-sidebar-border p-3 md:block">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full rounded-2xl"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
