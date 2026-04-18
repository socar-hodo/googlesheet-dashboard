"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { REGION1_OPTIONS } from "@/types/relocation";

interface Props {
  excluded: string[];
  onChange: (excluded: string[]) => void;
}

export function RegionExcludeFilter({ excluded, onChange }: Props) {
  function toggle(region: string) {
    onChange(
      excluded.includes(region)
        ? excluded.filter((r) => r !== region)
        : [...excluded, region]
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">지역 제외</CardTitle>
        <p className="text-xs text-muted-foreground">
          체크한 광역시도는 재배치 대상에서 제외됩니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {REGION1_OPTIONS.map((region) => (
          <div key={region} className="flex items-center gap-2">
            <Checkbox
              id={`exc-${region}`}
              checked={excluded.includes(region)}
              onCheckedChange={() => toggle(region)}
            />
            <Label htmlFor={`exc-${region}`} className="text-sm font-normal cursor-pointer">
              {region}
            </Label>
          </div>
        ))}
        {excluded.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {excluded.length}개 제외 중
          </p>
        )}
      </CardContent>
    </Card>
  );
}
