"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
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
  { icon: LayoutDashboard, label: "대시보드",    href: "/dashboard"   },
  { icon: Car,             label: "신차 배분",   href: "/allocation"  },
  { icon: ArrowLeftRight,  label: "차량 재배치", href: "/relocation"  },
  { icon: SearchCheck,     label: "워크스페이스", href: "/work-history"},
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
          className="fixed inset-0 z-40 bg-[#141A24]/56 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "hidden h-screen flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 md:flex",
          collapsed ? "w-20" : "w-72",
          mobileOpen && "!fixed inset-y-0 left-0 z-50 !flex w-72"
        )}
      >
        <div className="border-b border-sidebar-border px-4 py-4">
          <div
            className={cn(
              "rounded-[1.75rem] bg-[linear-gradient(145deg,#141A24_0%,#0A1491_55%,#0078FF_100%)] p-4 text-white shadow-[0_24px_60px_-34px_rgba(5,10,90,0.78)]",
              collapsed && "flex items-center justify-center p-3"
            )}
          >
            {collapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <CarFront className="h-5 w-5" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                    <CarFront className="h-5 w-5" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-white hover:bg-white/10 md:hidden"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">
                    SOCAR
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                    Workspace Hub
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/74">
                    자주 찾는 자료와 업무 흐름을 한 화면에서 빠르게 관리합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_14px_30px_-24px_rgba(0,120,255,0.85)] ring-1 ring-[#0078FF]/12"
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
