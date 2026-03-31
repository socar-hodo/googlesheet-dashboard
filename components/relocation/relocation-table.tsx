import type { RelocationRow } from "@/types/relocation";
import { cn } from "@/lib/utils";

interface Props {
  rows: RelocationRow[];
}

export function RelocationTable({ rows }: Props) {
  const sorted = [...rows].sort((left, right) => right.score - left.score);

  if (sorted.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">데이터가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-border/60 bg-background/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-3 text-left">
              권역
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              세부 존
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              가동률
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              대당 매출
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              사전예약률
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              종합 점수
            </th>
            <th scope="col" className="px-3 py-3 text-right">
              차량 수
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={`${row.region1}-${row.region2}`}
              className={cn(
                "border-b border-border/60 last:border-0 transition-colors",
                row.tier === "top" && "bg-green-50/60 dark:bg-green-950/20",
                row.tier === "bottom" && "bg-red-50/60 dark:bg-red-950/20",
              )}
            >
              <td className="px-3 py-3 text-muted-foreground">{row.region1}</td>
              <td className="px-3 py-3 font-medium text-foreground">{row.region2}</td>
              <td className="px-3 py-3 text-right">{(row.utilRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-3 text-right">
                {Math.round(row.revPerCar / 10000).toLocaleString("ko-KR")}만원
              </td>
              <td className="px-3 py-3 text-right">{(row.prereservRate * 100).toFixed(1)}%</td>
              <td className="px-3 py-3 text-right font-semibold">{row.score.toFixed(3)}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{row.carCount}대</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
