"use client";

// 카테고리별 분포 파이 차트
// Recharts는 DOM 조작이 필요하므로 Client Component 필수
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// TODO(Phase 5): 이 파일은 레거시 스타터킷 컴포넌트로 Phase 5에서 삭제 예정
// CategoryDistribution 타입은 Phase 1 타입 교체로 삭제됨 — 인라인 정의로 대체
interface CategoryDistribution {
  name: string;
  value: number;
}

// CSS 변수 대신 실제 색상 값 매핑 (Recharts SVG에서 CSS 변수가 작동하지 않을 수 있음)
const CHART_COLORS = [
  "hsl(220, 70%, 50%)",  // chart-1
  "hsl(160, 60%, 45%)",  // chart-2
  "hsl(30, 80%, 55%)",   // chart-3
  "hsl(280, 65%, 60%)",  // chart-4
  "hsl(340, 75%, 55%)",  // chart-5
];

interface CategoryChartProps {
  data: CategoryDistribution[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리 분포</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name} ${value}%`}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, "비율"]}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
