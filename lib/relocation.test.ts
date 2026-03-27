// lib/relocation.test.ts
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import {
  validateParams,
  loadSql,
  computeScore,
  computeRecommendations,
} from "./relocation";
import type { RelocationParams, RelocationRow } from "@/types/relocation";

const validParams: RelocationParams = {
  region1: "전체",
  pastDays: 14,
  futureDays: 7,
  weights: { utilization: 0.4, revenue: 0.4, prereservation: 0.2 },
};

describe("validateParams", () => {
  it("유효한 파라미터는 빈 배열 반환", () => {
    expect(validateParams(validParams)).toEqual([]);
  });

  it("허용되지 않는 pastDays는 오류", () => {
    expect(validateParams({ ...validParams, pastDays: 10 as 7 })).toHaveLength(1);
  });

  it("허용되지 않는 futureDays는 오류", () => {
    expect(validateParams({ ...validParams, futureDays: 5 as 3 })).toHaveLength(1);
  });

  it("weights 합계가 1.0이 아니면 오류", () => {
    expect(
      validateParams({
        ...validParams,
        weights: { utilization: 0.5, revenue: 0.5, prereservation: 0.2 },
      })
    ).toHaveLength(1);
  });

  it("region1에 단따옴표 포함 시 오류 (SQL injection)", () => {
    expect(validateParams({ ...validParams, region1: "서울'; DROP TABLE--" })).toHaveLength(1);
  });

  it("region1에 세미콜론 포함 시 오류", () => {
    expect(validateParams({ ...validParams, region1: "서울;명령어" })).toHaveLength(1);
  });
});

describe("loadSql", () => {
  it("region1='전체'이면 {region1_where}, {region1_where_z} 모두 빈 문자열로 치환", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-test.sql");
    writeFileSync(tmpSql, "SELECT {past_days} AS p, {future_days} AS f {region1_where} {region1_where_z}");

    const result = loadSql(validParams, tmpSql);
    expect(result).toContain("14");
    expect(result).toContain("7");
    expect(result).not.toContain("{past_days}");
    expect(result).not.toContain("{region1_where}");
    expect(result).not.toContain("{region1_where_z}");
    expect(result).not.toContain("AND region1");
  });

  it("region1이 특정 값이면 {region1_where} → AND region1 = '...'", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-region.sql");
    writeFileSync(tmpSql, "WHERE 1=1 {region1_where}");

    const result = loadSql({ ...validParams, region1: "서울특별시" }, tmpSql);
    expect(result).toContain("AND region1 = '서울특별시'");
  });

  it("region1이 특정 값이면 {region1_where_z} → AND z.region1 = '...'", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "relocation-z.sql");
    writeFileSync(tmpSql, "WHERE 1=1 {region1_where_z}");

    const result = loadSql({ ...validParams, region1: "서울특별시" }, tmpSql);
    expect(result).toContain("AND z.region1 = '서울특별시'");
  });
});

describe("computeScore", () => {
  const makeRow = (util: number, rev: number, pre: number): Omit<RelocationRow, "score" | "tier"> => ({
    region1: "서울", region2: "강남구",
    utilRate: util, revPerCar: rev, prereservRate: pre, carCount: 10,
  });

  const weights = { utilization: 0.4, revenue: 0.4, prereservation: 0.2 };

  it("여러 존이면 Min-Max 정규화 후 가중 합산", () => {
    const raw = [makeRow(0.5, 100000, 0.3), makeRow(0.8, 200000, 0.6)];
    const result = computeScore(raw as RelocationRow[], weights);
    expect(result[1].score).toBeGreaterThan(result[0].score);
  });

  it("단일 존(min==max)이면 score = 0.5", () => {
    const raw = [makeRow(0.6, 150000, 0.4)];
    const result = computeScore(raw as RelocationRow[], weights);
    expect(result[0].score).toBeCloseTo(0.5);
  });

  it("score 범위는 0~1", () => {
    const raw = [
      makeRow(0.1, 50000, 0.1),
      makeRow(0.5, 100000, 0.5),
      makeRow(0.9, 200000, 0.9),
    ];
    const result = computeScore(raw as RelocationRow[], weights);
    result.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    });
  });

  it("상위 20%는 tier=top, 하위 20%는 tier=bottom", () => {
    const raw = Array.from({ length: 5 }, (_, i) =>
      makeRow(i * 0.2, i * 50000, i * 0.2)
    );
    const result = computeScore(raw as RelocationRow[], weights);
    const sorted = [...result].sort((a, b) => b.score - a.score);
    expect(sorted[0].tier).toBe("top");
    expect(sorted[sorted.length - 1].tier).toBe("bottom");
  });

  it("20% 경계: 4개 존 → Math.ceil(4*0.2)=1개씩 top/bottom", () => {
    const raw = Array.from({ length: 4 }, (_, i) =>
      makeRow(i * 0.25, i * 40000, i * 0.25)
    );
    const result = computeScore(raw as RelocationRow[], weights);
    expect(result.filter((r) => r.tier === "top").length).toBeGreaterThanOrEqual(1);
    expect(result.filter((r) => r.tier === "bottom").length).toBeGreaterThanOrEqual(1);
  });
});

describe("computeRecommendations", () => {
  const makeScored = (
    r1: string, r2: string, tier: RelocationRow["tier"], count: number
  ): RelocationRow => ({
    region1: r1, region2: r2,
    utilRate: 0, revPerCar: 0, prereservRate: 0,
    carCount: count, score: 0, tier,
  });

  it("bottom 존은 top 존으로 매칭", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("서울", "중구",   "bottom", 10),
    ];
    const recs = computeRecommendations(rows);
    expect(recs).toHaveLength(1);
    expect(recs[0].fromZone).toBe("중구");
    expect(recs[0].fromRegion1).toBe("서울");
    expect(recs[0].toZone).toBe("강남구");
    expect(recs[0].toRegion1).toBe("서울");
  });

  it("이동 대수 = carCount × 0.2 반올림, 최소 1", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("서울", "중구",   "bottom", 3),
    ];
    const recs = computeRecommendations(rows);
    expect(recs[0].carCount).toBe(1); // Math.round(3 * 0.2) = 1
  });

  it("동일 region1 우선 매칭", () => {
    const rows = [
      makeScored("서울", "강남구", "top",    20),
      makeScored("부산", "해운대구", "top",  15),
      makeScored("서울", "중구",  "bottom",  10),
    ];
    const recs = computeRecommendations(rows);
    const fromJung = recs.find((r) => r.fromZone === "중구");
    expect(fromJung?.toZone).toBe("강남구");
    expect(fromJung?.sameRegion).toBe(true);
  });

  it("같은 region1 top 없으면 타 지역으로 매칭", () => {
    const rows = [
      makeScored("부산", "해운대구", "top",  15),
      makeScored("서울", "중구",    "bottom", 10),
    ];
    const recs = computeRecommendations(rows);
    expect(recs[0].sameRegion).toBe(false);
  });

  it("top이 없으면 빈 배열 반환", () => {
    const rows = [makeScored("서울", "중구", "bottom", 10)];
    expect(computeRecommendations(rows)).toEqual([]);
  });
});
