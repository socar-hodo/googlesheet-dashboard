import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { validateParams, computeSpearman, loadSql } from "./allocation";

describe("validateParams", () => {
  const valid = {
    carModel: "아반떼",
    carSegment: "준중형",
    totalCars: 50,
    baseDate: "2026-01-01",
  };

  it("유효한 파라미터는 빈 배열 반환", () => {
    expect(validateParams(valid)).toEqual([]);
  });

  it("단따옴표 포함 시 오류", () => {
    expect(validateParams({ ...valid, carModel: "아반'떼" })).toHaveLength(1);
  });

  it("총 대수 0 이하 시 오류", () => {
    expect(validateParams({ ...valid, totalCars: 0 })).toHaveLength(1);
  });

  it("올바르지 않은 세그먼트 오류", () => {
    expect(validateParams({ ...valid, carSegment: "없는세그먼트" })).toHaveLength(1);
  });

  it("날짜 형식 오류", () => {
    expect(validateParams({ ...valid, baseDate: "20260101" })).toHaveLength(1);
  });

  it("오늘 이후 날짜 오류", () => {
    expect(validateParams({ ...valid, baseDate: "2099-01-01" })).toHaveLength(1);
  });
});

describe("computeSpearman", () => {
  it("완전 일치 순위는 1.0 반환", () => {
    expect(computeSpearman([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
  });

  it("완전 역순위는 -1.0 반환", () => {
    expect(computeSpearman([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1.0);
  });

  it("길이가 다르면 null 반환", () => {
    expect(computeSpearman([1, 2], [1, 2, 3])).toBeNull();
  });

  it("길이 0이면 null 반환", () => {
    expect(computeSpearman([], [])).toBeNull();
  });
});

describe("loadSql", () => {
  it("파라미터가 SQL에 치환됨", () => {
    // 임시 SQL 파일 생성
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test.sql");
    writeFileSync(tmpSql, "SELECT '{car_model}' AS m, {total_cars} AS n, {alpha} AS a");

    const result = loadSql(
      { carModel: "아반떼", carSegment: "준중형", totalCars: 50, baseDate: "2026-01-01" },
      0.5,
      tmpSql
    );
    expect(result).toContain("아반떼");
    expect(result).toContain("50");
    expect(result).toContain("0.5");
    expect(result).not.toContain("{car_model}");
  });

  it("선두 주석 블록(--) 제거됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-comment.sql");
    writeFileSync(tmpSql, "-- 주석\n-- 주석2\nSELECT 1");

    const result = loadSql(
      { carModel: "x", carSegment: "준중형", totalCars: 1, baseDate: "2026-01-01" },
      0.5,
      tmpSql
    );
    expect(result.trim()).toBe("SELECT 1");
  });
});
