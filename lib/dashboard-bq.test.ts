import { describe, it, expect } from "vitest";
import {
  sanitizeRegionName,
  buildRegionFilter,
  buildRegionOptions,
} from "./dashboard-region-utils";

describe("sanitizeRegionName", () => {
  it("정상 한글 지역명은 그대로 반환", () => {
    expect(sanitizeRegionName("서울특별시")).toBe("서울특별시");
    expect(sanitizeRegionName("강남구")).toBe("강남구");
    expect(sanitizeRegionName("경상남도")).toBe("경상남도");
  });

  it("작은따옴표는 제거 (SQL injection 방지)", () => {
    expect(sanitizeRegionName("서울'; DROP TABLE x;--")).toBe("서울 DROP TABLE x");
  });

  it("세미콜론도 제거", () => {
    expect(sanitizeRegionName("seoul;select")).toBe("seoulselect");
  });

  it("백슬래시/언더스코어 등 특수문자 제거", () => {
    expect(sanitizeRegionName("a\\b_c")).toBe("abc");
  });

  it("영문/숫자/공백/괄호/하이픈은 허용", () => {
    expect(sanitizeRegionName("Test Region (1)-B")).toBe("Test Region (1)-B");
  });

  it("50자 초과는 잘라냄", () => {
    const long = "가".repeat(100);
    expect(sanitizeRegionName(long).length).toBe(50);
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(sanitizeRegionName("")).toBe("");
  });
});

describe("buildRegionFilter", () => {
  it("region1/region2 둘 다 없으면 빈 문자열 (전국)", () => {
    expect(buildRegionFilter()).toBe("");
    expect(buildRegionFilter(undefined, undefined)).toBe("");
    expect(buildRegionFilter("")).toBe("");
  });

  it("region1만 → AND region1 = '...' 한 줄", () => {
    expect(buildRegionFilter("서울특별시")).toBe("AND region1 = '서울특별시'");
  });

  it("region1+region2 → 두 조건 AND", () => {
    expect(buildRegionFilter("서울특별시", "강남구")).toBe(
      "AND region1 = '서울특별시' AND region2 = '강남구'",
    );
  });

  it("region2만 주어지면 무시 (region1 없으면)", () => {
    expect(buildRegionFilter(undefined, "강남구")).toBe("");
  });

  it("SQL injection 시도 — 작은따옴표 제거 후 삽입", () => {
    // "'); DROP TABLE" 입력이 있어도 작은따옴표가 제거되어 안전
    const malicious = "x'; DROP TABLE users;--";
    const result = buildRegionFilter(malicious);
    expect(result).not.toContain("';");
    expect(result).not.toContain("--");
    expect(result).toBe("AND region1 = 'x DROP TABLE users'");
    // 결과 문자열이 닫는 작은따옴표를 항상 가짐 — 유효한 SQL 문자열 리터럴
    expect(result.split("'").length).toBe(3); // opening + closing 따옴표 쌍
  });
});

describe("buildRegionOptions", () => {
  it("빈 배열은 빈 결과", () => {
    expect(buildRegionOptions([])).toEqual([]);
  });

  it("region1별로 region2를 그룹화", () => {
    const rows = [
      { region1: "서울특별시", region2: "강남구" },
      { region1: "서울특별시", region2: "송파구" },
      { region1: "경기도", region2: "수원시" },
    ];
    const result = buildRegionOptions(rows);
    expect(result).toEqual([
      { region1: "서울특별시", region2List: ["강남구", "송파구"] },
      { region1: "경기도", region2List: ["수원시"] },
    ]);
  });

  it("region2 중복 제거", () => {
    const rows = [
      { region1: "서울특별시", region2: "강남구" },
      { region1: "서울특별시", region2: "강남구" },
      { region1: "서울특별시", region2: "송파구" },
    ];
    const result = buildRegionOptions(rows);
    expect(result[0].region2List).toEqual(["강남구", "송파구"]);
  });

  it("region1 빈값은 스킵", () => {
    const rows = [
      { region1: "", region2: "X" },
      { region1: "서울특별시", region2: "강남구" },
    ];
    const result = buildRegionOptions(rows);
    expect(result).toHaveLength(1);
    expect(result[0].region1).toBe("서울특별시");
  });

  it("region2 빈값이면 region1만 생성하고 region2List는 빈 배열", () => {
    const rows = [{ region1: "세종특별자치시", region2: "" }];
    const result = buildRegionOptions(rows);
    expect(result).toEqual([{ region1: "세종특별자치시", region2List: [] }]);
  });
});
