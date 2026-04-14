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
  MousePointerClick,
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
  { icon: MousePointerClick, label: "전환율 퍼널", href: "/funnel" },
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
        className="fixed left-3 top-3 z-50 border border-white/10 bg-[#141A24] text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.4)] md:hidden"
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
          "hidden h-screen flex-col border-r border-sidebar-border bg-[#141A24] transition-all duration-300 md:flex",
          collapsed ? "w-20" : "w-72",
          mobileOpen && "!fixed inset-y-0 left-0 z-50 !flex w-72",
        )}
      >
        <div className="border-b border-sidebar-border px-4 py-4">
          <div
            className={cn(
              "p-4",
              collapsed && "flex items-center justify-center p-3",
            )}
          >
            {collapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0078FF] text-white shadow-[0_8px_20px_-8px_rgba(0,120,255,0.55)]">
                <SearchCheck className="h-5 w-5" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0078FF] text-white shadow-[0_8px_20px_-8px_rgba(0,120,255,0.55)]">
                    <SearchCheck className="h-5 w-5" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-white/60 hover:bg-white/10 hover:text-white md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-label="메뉴 닫기"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    HODO
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
                    호도 대시보드
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    지역사업팀 통합 업무 도구
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
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
                    ? "bg-[#0078FF] text-white shadow-[0_8px_24px_-10px_rgba(0,120,255,0.65)]"
                    : "text-white/60 hover:bg-white/8 hover:text-white",
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
            className="w-full rounded-2xl text-white/50 hover:bg-white/10 hover:text-white"
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
