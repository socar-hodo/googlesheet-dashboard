"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RegionOption } from "@/types/dashboard";

const ALL_REGIONS = "__ALL__"; // 전국 sentinel — Radix Select는 빈 value를 허용 안 함
const ALL_REGION2 = "__ALL2__";

interface Props {
  regionOptions: RegionOption[];
  current: { region1?: string; region2?: string };
}

export function RegionSelector({ regionOptions, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const region1List = useMemo(
    () => regionOptions.map((o) => o.region1).sort((a, b) => a.localeCompare(b)),
    [regionOptions],
  );

  const region2List = useMemo(() => {
    if (!current.region1) return [];
    const match = regionOptions.find((o) => o.region1 === current.region1);
    return (match?.region2List ?? []).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [regionOptions, current.region1]);

  function navigate(nextRegion1?: string, nextRegion2?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextRegion1) {
      params.set("region1", nextRegion1);
    } else {
      params.delete("region1");
    }
    if (nextRegion2) {
      params.set("region2", nextRegion2);
    } else {
      params.delete("region2");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={current.region1 ?? ALL_REGIONS}
        onValueChange={(v) => navigate(v === ALL_REGIONS ? undefined : v, undefined)}
      >
        <SelectTrigger className="h-9 min-w-[130px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_REGIONS}>전국</SelectItem>
          {region1List.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.region2 ?? ALL_REGION2}
        onValueChange={(v) => navigate(current.region1, v === ALL_REGION2 ? undefined : v)}
        disabled={!current.region1}
      >
        <SelectTrigger className="h-9 min-w-[130px] text-sm">
          <SelectValue placeholder={current.region1 ? "시/군/구 전체" : "상위 지역 먼저"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_REGION2}>시/군/구 전체</SelectItem>
          {region2List.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
