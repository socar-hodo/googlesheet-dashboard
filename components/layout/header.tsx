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

const titleMap: Record<string, { eyebrow: string; title: string }> = {
  "/dashboard": { eyebrow: "SOCAR Dashboard", title: "대시보드" },
  "/work-history": { eyebrow: "SOCAR Workspace", title: "나의 워크스페이스 포털" },
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const headerCopy = useMemo(() => {
    const matched = Object.entries(titleMap).find(([route]) => pathname.startsWith(route));
    return matched?.[1] ?? titleMap["/dashboard"];
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="pl-10 md:pl-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {headerCopy.eyebrow}
          </p>
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            {headerCopy.title}
          </h1>
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
