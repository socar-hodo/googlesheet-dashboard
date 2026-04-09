"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

const titleMap: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/dashboard": {
    eyebrow: "Dashboard",
    title: "운영 대시보드",
    description: "배분, 재배치, 주요 지표 화면을 빠르게 오가며 확인합니다.",
  },
  "/allocation": {
    eyebrow: "Allocation",
    title: "신차 배분",
    description: "배분 실행과 결과를 단정한 흐름으로 검토합니다.",
  },
  "/relocation": {
    eyebrow: "Relocation",
    title: "재배치 추천",
    description: "이동 추천 차량과 권역별 후보를 비교합니다.",
  },
  "/work-history": {
    eyebrow: "Workspace",
    title: "개인 워크스페이스",
    description: "문서 검색, 메모, To-do를 하나의 허브로 정리합니다.",
  },
  "/roas": {
    eyebrow: "ROAS",
    title: "ROAS 시뮬레이터",
    description: "쿠폰 캠페인의 ROI를 시뮬레이션하고 효과를 분석합니다.",
  },
  "/zone": {
    eyebrow: "Zone",
    title: "존 시뮬레이터",
    description: "존 개설·폐쇄·비교·최적화를 데이터 기반으로 시뮬레이션합니다.",
  },
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const headerCopy = useMemo(() => {
    const matched = Object.entries(titleMap).find(([route]) => pathname.startsWith(route));
    return matched?.[1] ?? titleMap["/dashboard"];
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/88 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-6 py-3">
        <div className="pl-10 md:pl-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
            {headerCopy.eyebrow}
          </p>
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            {headerCopy.title}
          </h1>
          <p className="mt-0.5 hidden text-sm text-muted-foreground lg:block">
            {headerCopy.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Avatar className="h-9 w-9 cursor-pointer border border-border/70 shadow-[0_10px_24px_-18px_rgba(20,26,36,0.6)]">
                <AvatarImage
                  src={session?.user?.image ?? ""}
                  alt={session?.user?.name ?? "사용자"}
                />
                <AvatarFallback>{session?.user?.name?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
