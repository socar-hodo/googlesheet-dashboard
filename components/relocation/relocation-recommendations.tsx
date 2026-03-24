import type { RelocationRecommendation } from "@/types/relocation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  recommendations: RelocationRecommendation[];
}

export function RelocationRecommendations({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        추천할 재배치 경로가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((rec, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
        >
          <span className="font-semibold text-red-600 dark:text-red-400">{rec.fromZone}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-green-600 dark:text-green-400">{rec.toZone}</span>
          <span className="ml-auto font-medium">{rec.carCount}대 이동 권장</span>
          {rec.sameRegion && (
            <Badge variant="secondary" className="text-xs">동일 시/도</Badge>
          )}
        </div>
      ))}
    </div>
  );
}
