import type { RelocationRow } from "@/types/relocation";
import { cn } from "@/lib/utils";

interface Props {
  rows: RelocationRow[];
}

export function RelocationTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left">시/도</th>
            <th scope="col" className="px-3 py-2 text-left">시/군/구</th>
            <th scope="col" className="px-3 py-2 text-right">가동률</th>
            <th scope="col" className="px-3 py-2 text-right">대당매출</th>
            <th scope="col" className="px-3 py-2 text-right">사전예약률</th>
            <th scope="col" className="px-3 py-2 text-right">종합스코어</th>
            <th scope="col" className="px-3 py-2 text-right">차량수</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={`${row.region1}-${row.region2}`}
              className={cn(
                "border-b last:border-0 transition-colors",
                row.tier === "top"    && "bg-green-50 dark:bg-green-950/30",
                row.tier === "bottom" && "bg-red-50 dark:bg-red-950/30"
              )}
            >
              <td className="px-3 py-2 text-muted-foreground">{row.region1}</td>
              <td className="px-3 py-2 font-medium">{row.region2}</td>
              <td className="px-3 py-2 text-right">{(row.utilRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">{Math.round(row.revPerCar / 10000).toLocaleString("ko-KR")}만원</td>
              <td className="px-3 py-2 text-right">{(row.prereservRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-2 text-right font-semibold">{row.score.toFixed(3)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.carCount}대</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
