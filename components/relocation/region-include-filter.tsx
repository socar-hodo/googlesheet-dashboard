"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { REGION1_OPTIONS } from "@/types/relocation";

interface Props {
  included: string[];
  onChange: (included: string[]) => void;
}

export function RegionIncludeFilter({ included, onChange }: Props) {
  function toggle(region: string) {
    onChange(
      included.includes(region)
        ? included.filter((r) => r !== region)
        : [...included, region]
    );
  }

  function selectAll() {
    onChange([...REGION1_OPTIONS]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">분석 지역 선택</CardTitle>
        <p className="text-xs text-muted-foreground">
          체크한 광역시도만 재배치 대상입니다. 선택 없음 = 전국.
        </p>
        <div className="mt-2 flex gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            전체 선택
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:underline"
          >
            전체 해제
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {REGION1_OPTIONS.map((region) => (
          <div key={region} className="flex items-center gap-2">
            <Checkbox
              id={`inc-${region}`}
              checked={included.includes(region)}
              onCheckedChange={() => toggle(region)}
            />
            <Label htmlFor={`inc-${region}`} className="text-sm font-normal cursor-pointer">
              {region}
            </Label>
          </div>
        ))}
        {included.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {included.length}개 지역 대상
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            전국 대상 (선택 없음)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
