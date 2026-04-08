"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const roasTabs = [
  { label: "시뮬레이션", href: "/roas" },
  { label: "캠페인 분석", href: "/roas/analysis" },
];

export default function RoasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 rounded-2xl border border-border/60 bg-card/90 p-1.5 shadow-[0_12px_30px_-20px_rgba(20,26,36,0.12)]">
        {roasTabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
