"use client";

// 반응형 사이드바 네비게이션
// 데스크톱: 접기/펼치기 가능, 모바일: 오버레이로 표시
import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// 네비게이션 메뉴 항목
const navItems = [
  {
    icon: LayoutDashboard,
    label: "대시보드",
    href: "/dashboard",
  },
  // 향후 메뉴 추가 가능
  // { icon: Settings, label: "설정", href: "/settings" },
];

export function Sidebar() {
  // 데스크톱 접기/펼치기 상태
  const [collapsed, setCollapsed] = useState(false);
  // 모바일 메뉴 열림/닫힘 상태
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* 모바일 햄버거 메뉴 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* 모바일 오버레이 배경 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 사이드바 본체 */}
      <aside
        className={cn(
          // 기본 스타일
          "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          // 데스크톱: 접기/펼치기
          "hidden md:flex",
          collapsed ? "w-16" : "w-64",
          // 모바일: 오버레이
          mobileOpen && "!fixed inset-y-0 left-0 z-50 !flex w-64"
        )}
      >
        {/* 상단: 로고 + 모바일 닫기 */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">
              Dashboard
            </span>
          )}
          {/* 모바일 닫기 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* 하단: 접기/펼치기 버튼 (데스크톱만) */}
        <div className="hidden border-t border-sidebar-border p-2 md:block">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full"
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
