import { describe, it, expect } from "vitest";
import { aggregateKpi, calcDelta, formatKpiValue, formatDelta } from "./kpi-utils";

const make = (o: Partial<{
  revenue: number;
  profit: number;
  revenuePerCar: number;
  usageCountPerCar: number;
  usageHoursPerCar: number;
  utilizationRate: number;
}>) => ({
  revenue: o.revenue ?? 0,
  profit: o.profit ?? 0,
  revenuePerCar: o.revenuePerCar ?? 0,
  usageCountPerCar: o.usageCountPerCar ?? 0,
  usageHoursPerCar: o.usageHoursPerCar ?? 0,
  utilizationRate: o.utilizationRate ?? 0,
});

describe("aggregateKpi", () => {
  it("빈 배열 → 모두 0", () => {
    expect(aggregateKpi([])).toEqual({
      revenue: 0, profit: 0, gpm: 0,
      revenuePerCar: 0, usageCountPerCar: 0, usageHoursPerCar: 0,
      utilizationRate: 0,
    });
  });

  it("revenue/profit은 SUM, GPM은 SUM(profit)/SUM(revenue)*100", () => {
    const result = aggregateKpi([
      make({ revenue: 100, profit: 10 }),
      make({ revenue: 200, profit: 30 }),
    ]);
    expect(result.revenue).toBe(300);
    expect(result.profit).toBe(40);
    // GPM = 40/300 * 100 = 13.33...
    expect(result.gpm).toBeCloseTo(13.33, 1);
  });

  it("revenue=0일 때 GPM은 0 (0 나누기 방지)", () => {
    const result = aggregateKpi([make({ revenue: 0, profit: -5 })]);
    expect(result.gpm).toBe(0);
  });

  it("대당값은 평균으로 집계", () => {
    const result = aggregateKpi([
      make({ revenuePerCar: 100, usageCountPerCar: 1, usageHoursPerCar: 6, utilizationRate: 40 }),
      make({ revenuePerCar: 300, usageCountPerCar: 3, usageHoursPerCar: 10, utilizationRate: 60 }),
    ]);
    expect(result.revenuePerCar).toBe(200);    // (100+300)/2
    expect(result.usageCountPerCar).toBe(2);   // (1+3)/2
    expect(result.usageHoursPerCar).toBe(8);   // (6+10)/2
    expect(result.utilizationRate).toBe(50);   // (40+60)/2
  });

  it("음수 profit도 정상 집계 (손실 케이스)", () => {
    const result = aggregateKpi([
      make({ revenue: 100, profit: -20 }),
      make({ revenue: 100, profit: -10 }),
    ]);
    expect(result.profit).toBe(-30);
    expect(result.gpm).toBe(-15); // -30/200 * 100
  });
});

describe("calcDelta", () => {
  it("증가 → 양수 percent/absolute", () => {
    expect(calcDelta(120, 100)).toEqual({ percent: 20, absolute: 20 });
  });
  it("감소 → 음수", () => {
    expect(calcDelta(80, 100)).toEqual({ percent: -20, absolute: -20 });
  });
  it("previous=0 → percent=0, absolute=current", () => {
    expect(calcDelta(50, 0)).toEqual({ percent: 0, absolute: 50 });
  });
  it("음수 previous도 abs로 계산", () => {
    // (-10 - (-20)) / |-20| = 10/20 = 50%
    expect(calcDelta(-10, -20)).toEqual({ percent: 50, absolute: 10 });
  });
});

describe("formatKpiValue", () => {
  it("원은 만 단위", () => {
    expect(formatKpiValue(12345678, "원")).toBe("₩1,235만");
  });
  it("원/대는 원 단위 그대로", () => {
    expect(formatKpiValue(45678, "원/대")).toBe("₩45,678원");
  });
  it("% 소수 1자리", () => {
    expect(formatKpiValue(13.456, "%")).toBe("13.5%");
  });
  it("건/대 소수 1자리", () => {
    expect(formatKpiValue(0.73, "건/대")).toBe("0.7건");
  });
  it("시간/대 소수 1자리", () => {
    expect(formatKpiValue(8.72, "시간/대")).toBe("8.7시간");
  });
});

describe("formatDelta", () => {
  it("양수 원 → ▲ +N% / ₩N만", () => {
    expect(formatDelta(15, 1500000, "원")).toBe("▲ +15% / ₩150만");
  });
  it("음수 % → ▼ -N% / N.N%p", () => {
    expect(formatDelta(-10, -2.5, "%")).toBe("▼ -10% / 2.5%p");
  });
  it("건/대 소수 1자리", () => {
    expect(formatDelta(5, 0.03, "건/대")).toBe("▲ +5% / 0.0건");
  });
});
