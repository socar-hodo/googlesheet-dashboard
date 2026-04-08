"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Car,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Menu,
  SearchCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "대시보드", href: "/dashboard" },
  { icon: Car, label: "신차 배분", href: "/allocation" },
  { icon: ArrowLeftRight, label: "재배치 추천", href: "/relocation" },
  { icon: TrendingUp, label: "ROAS 시뮬레이터", href: "/roas" },
  { icon: MapPin, label: "존 시뮬레이터", href: "/zone" },
  { icon: SearchCheck, label: "워크스페이스", href: "/work-history" },
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
        className="fixed left-3 top-3 z-50 border border-border/70 bg-card/80 shadow-[0_12px_30px_-20px_rgba(20,26,36,0.45)] backdrop-blur md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/56 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "hidden h-screen flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-all duration-300 md:flex",
          collapsed ? "w-20" : "w-72",
          mobileOpen && "!fixed inset-y-0 left-0 z-50 !flex w-72",
        )}
      >
        <div className="border-b border-sidebar-border px-4 py-4">
          <div
            className={cn(
              "rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-[0_18px_40px_-34px_rgba(20,26,36,0.35)]",
              collapsed && "flex items-center justify-center p-3",
            )}
          >
            {collapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
                <SearchCheck className="h-5 w-5" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                    <SearchCheck className="h-5 w-5" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-label="메뉴 닫기"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    HODO
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
                    호도 대시보드
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    지역사업팀 통합 업무 도구
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
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-foreground text-background shadow-[0_14px_30px_-24px_rgba(20,26,36,0.55)]"
                    : "text-muted-foreground hover:bg-white/60 hover:text-sidebar-foreground dark:hover:bg-white/5",
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
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
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
