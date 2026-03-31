import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { validateParams, computeSpearman, loadSql, loadSqlR2 } from "./allocation";

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

  it("길이 1이면 null 반환 (n<2 가드)", () => {
    expect(computeSpearman([1], [1])).toBeNull();
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

  it("빈 carModel이면 __NO_MODEL__로 치환됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-nomodel.sql");
    writeFileSync(tmpSql, "SELECT '{car_model}' AS m");

    const result = loadSql(
      { carModel: "", carSegment: "준중형", totalCars: 50, baseDate: "2026-01-01" },
      0.5,
      tmpSql
    );
    expect(result).toContain("__NO_MODEL__");
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

describe("loadSqlR2", () => {
  it("region1List가 IN절로 치환됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-r2.sql");
    writeFileSync(tmpSql, "WHERE p.region1 IN ({region1_list}) AND m = '{car_segment}' AND a = {alpha}");

    const result = loadSqlR2(
      { carModel: "", carSegment: "준중형", totalCars: 20, baseDate: "2026-01-01", region1List: ["경상남도", "울산광역시"] },
      0.5,
      tmpSql
    );
    expect(result).toContain("'경상남도', '울산광역시'");
    expect(result).not.toContain("{region1_list}");
  });

  it("화이트리스트에 없는 region은 제외됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-r2-wl.sql");
    writeFileSync(tmpSql, "IN ({region1_list})");

    const result = loadSqlR2(
      { carModel: "", carSegment: "준중형", totalCars: 20, baseDate: "2026-01-01", region1List: ["경상남도", "INJECTED'; DROP TABLE--"] },
      0.5,
      tmpSql
    );
    expect(result).toContain("'경상남도'");
    expect(result).not.toContain("INJECTED");
  });

  it("중복 region이 제거됨", () => {
    const tmpDir = resolve(process.cwd(), "tmp-test");
    mkdirSync(tmpDir, { recursive: true });
    const tmpSql = resolve(tmpDir, "test-r2-dup.sql");
    writeFileSync(tmpSql, "IN ({region1_list})");

    const result = loadSqlR2(
      { carModel: "", carSegment: "준중형", totalCars: 20, baseDate: "2026-01-01", region1List: ["경상남도", "경상남도"] },
      0.5,
      tmpSql
    );
    expect(result).toBe("IN ('경상남도')");
  });
});

describe("validateParams — 추가 검증", () => {
  const valid = {
    carModel: "아반떼",
    carSegment: "준중형",
    totalCars: 50,
    baseDate: "2026-01-01",
  };

  it("totalCars 10000 초과 시 오류", () => {
    expect(validateParams({ ...valid, totalCars: 10001 })).toHaveLength(1);
  });

  it("carModel 빈 문자열 허용", () => {
    expect(validateParams({ ...valid, carModel: "" })).toEqual([]);
  });

  it("region2 모드에서 region1List 비어있으면 오류", () => {
    expect(validateParams({ ...valid, mode: "region2", region1List: [] })).toHaveLength(1);
  });

  it("region2 모드에서 올바른 region1List 통과", () => {
    expect(validateParams({ ...valid, mode: "region2", region1List: ["경상남도"] })).toEqual([]);
  });
});
