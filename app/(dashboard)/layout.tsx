import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// 대시보드 공통 레이아웃: 사이드바 + 헤더 + 콘텐츠 영역
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 좌측 사이드바 */}
      <Sidebar />

      {/* 우측: 헤더 + 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="대시보드" />
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
