'use client';

// components/dashboard/charts/cost-breakdown-donut.tsx
// 비용 분석 도넛 — 13개 카테고리 합산 (COST-01)

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getChartColors } from './chart-colors';
import type { CostBreakdownRow } from '@/types/dashboard';

interface CostBreakdownDonutProps {
  data: CostBreakdownRow[];
}

function formatWonShort(won: number): string {
  if (won === 0) return '0원';
  const eok = won / 1_0000_0000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  const man = won / 10_000;
  return `${Math.round(man).toLocaleString()}만원`;
}

interface CostTotals {
  depreciation: number;
  commission: number;
  fuel: number;
  parking: number;
  transport: number;
  inspection: number;
  insurance: number;
  tax: number;
  repair: number;
  chargeEv: number;
  wash: number;
  maintenance: number;
  communication: number;
}

export function CostBreakdownDonut({ data }: CostBreakdownDonutProps) {
  const { resolvedTheme } = useTheme();
  const colors = getChartColors(resolvedTheme === 'dark');

  const totals: CostTotals = data.reduce(
    (acc, row) => ({
      depreciation: acc.depreciation + row.depreciationCost,
      commission: acc.commission + row.commissionCost,
      fuel: acc.fuel + row.fuelCost,
      parking: acc.parking + row.parkingCost,
      transport: acc.transport + row.transportCost,
      inspection: acc.inspection + row.inspectionCost,
      insurance: acc.insurance + row.insuranceCost,
      tax: acc.tax + row.taxCost,
      repair: acc.repair + row.repairCost,
      chargeEv: acc.chargeEv + row.chargeEvCost,
      wash: acc.wash + row.washCost,
      maintenance: acc.maintenance + row.maintenanceCost,
      communication: acc.communication + row.communicationCost,
    }),
    {
      depreciation: 0,
      commission: 0,
      fuel: 0,
      parking: 0,
      transport: 0,
      inspection: 0,
      insurance: 0,
      tax: 0,
      repair: 0,
      chargeEv: 0,
      wash: 0,
      maintenance: 0,
      communication: 0,
    },
  );

  const total =
    totals.depreciation +
    totals.commission +
    totals.fuel +
    totals.parking +
    totals.transport +
    totals.inspection +
    totals.insurance +
    totals.tax +
    totals.repair +
    totals.chargeEv +
    totals.wash +
    totals.maintenance +
    totals.communication;

  // 색 매핑은 카테고리별 고정. 최상위 2개(연료/감가)가 모두 블루 계열이라 시각적 구분이 약한 문제 해결을 위해
  // 연료는 chart7(teal)로 스왑. 보험은 원래 할당이던 chart7 대신 chart3(다크블루)을 받는다.
  const palette = [
    { name: '감가', value: totals.depreciation, color: colors.chart1 },
    { name: '수수료', value: totals.commission, color: colors.chart2 },
    { name: '연료', value: totals.fuel, color: colors.chart7 },
    { name: '주차', value: totals.parking, color: colors.chart4 },
    { name: '운반', value: totals.transport, color: colors.chart5 },
    { name: '점검', value: totals.inspection, color: colors.chart6 },
    { name: '보험', value: totals.insurance, color: colors.chart3 },
    { name: '세금', value: totals.tax, color: colors.chart8 },
    { name: '수리', value: totals.repair, color: colors.chart9 },
    { name: 'EV충전', value: totals.chargeEv, color: colors.chart10 },
    { name: '세차', value: totals.wash, color: colors.chart11 },
    { name: '유지', value: totals.maintenance, color: colors.chart12 },
    { name: '통신', value: totals.communication, color: colors.chart13 },
  ];
  // 값 0 카테고리 제거 후 내림차순 정렬 — 큰 조각부터 렌더되어 시계 방향으로 크기 순서 인식이 직관적
  const pieData = palette.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

  if (data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>비용 구성</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비용 구성</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="비용 구성 도넛 차트">
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <PieChart>
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.axis}
                fontSize="14px"
                fontWeight="600"
              >
                총 {formatWonShort(total)}
              </text>
              <Pie
                data={pieData}
                dataKey="value"
                innerRadius="60%"
                outerRadius="80%"
                label={false}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => (
                  <span style={{ color: colors.axis }}>{value}</span>
                )}
              />
              <Tooltip
                formatter={(value, name) => {
                  const numValue = Number(value);
                  const pct = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0';
                  return [`${formatWonShort(numValue)} (${pct}%)`, name];
                }}
                contentStyle={{
                  backgroundColor: colors.tooltip.bg,
                  border: `1px solid ${colors.tooltip.border}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
