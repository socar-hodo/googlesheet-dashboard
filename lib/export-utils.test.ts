// export-utils 단위 테스트 — 순수 함수만 테스트 (브라우저 API 의존 함수 제외)
// exportToCsv/exportToXlsx의 통합 테스트는 체크포인트 브라우저 검증으로 대체
import { describe, it, expect } from 'vitest';
import {
  toDateString,
  dailyToRows,
  weeklyToRows,
  escapeCsvField,
} from './export-utils';
import type { DailyRecord, WeeklyRecord } from '../types/dashboard';

// ---------------------------------------------------------------------------
// toDateString — 로컬 시간 기준 날짜 문자열 생성
// ---------------------------------------------------------------------------

describe('toDateString — 로컬 시간 기준 YYYY-MM-DD', () => {
  it('2026년 3월 1일 → "2026-03-01"', () => {
    // new Date(year, monthIndex, day) — 월은 0-indexed
    expect(toDateString(new Date(2026, 2, 1))).toBe('2026-03-01');
  });

  it('2025년 12월 31일 → "2025-12-31"', () => {
    expect(toDateString(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('2026년 1월 9일 → "2026-01-09" (한 자리 월/일 패딩)', () => {
    expect(toDateString(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

// ---------------------------------------------------------------------------
// escapeCsvField — RFC 4180 CSV 이스케이프
// ---------------------------------------------------------------------------

describe('escapeCsvField — RFC 4180 준수', () => {
  it('일반 문자열은 그대로 반환', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('숫자는 문자열로 변환', () => {
    expect(escapeCsvField(123)).toBe('123');
  });

  it('null/undefined는 빈 문자열로 변환', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('콤마 포함 시 따옴표로 감싼다', () => {
    expect(escapeCsvField('hello,world')).toBe('"hello,world"');
  });

  it('큰따옴표 포함 시 "" 이스케이프 후 따옴표로 감싼다', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('줄바꿈 포함 시 따옴표로 감싼다', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('빈 문자열은 그대로 반환', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// dailyToRows — DailyRecord[] → plain object 배열 변환
// ---------------------------------------------------------------------------

describe('dailyToRows — DailyRecord 변환', () => {
  const records: DailyRecord[] = [
    { date: '2026-03-01', revenue: 1000000, profit: 100000, usageHours: 8, usageCount: 5, utilizationRate: 80, revenuePerCar: 0, usageCountPerCar: 0, usageHoursPerCar: 0 },
    { date: '2026-03-02', revenue: 2000000, profit: -50000, usageHours: 9, usageCount: 6, utilizationRate: 85, revenuePerCar: 0, usageCountPerCar: 0, usageHoursPerCar: 0 },
  ];

  it('입력 레코드 수와 동일한 행 수를 반환한다', () => {
    expect(dailyToRows(records)).toHaveLength(2);
  });

  it('첫 번째 행의 키 목록이 올바르다 (날짜,매출,대당매출,손익,대당이용시간,대당이용건수,가동률)', () => {
    const rows = dailyToRows(records);
    const keys = Object.keys(rows[0]);
    expect(keys).toEqual(['날짜', '매출', '대당 매출', '손익', '대당 이용시간', '대당 이용건수', '가동률']);
  });

  it('날짜 필드 값이 원본 date 문자열과 동일하다', () => {
    const rows = dailyToRows(records);
    expect(rows[0]['날짜']).toBe('2026-03-01');
    expect(rows[1]['날짜']).toBe('2026-03-02');
  });

  it('매출 값이 raw number (포맷 없음)', () => {
    const rows = dailyToRows(records);
    expect(rows[0]['매출']).toBe(1000000);
    expect(rows[1]['매출']).toBe(2000000);
  });

  it('음수 손익 값을 그대로 유지한다', () => {
    const rows = dailyToRows(records);
    expect(rows[1]['손익']).toBe(-50000);
  });

  it('빈 배열을 전달하면 빈 배열을 반환한다', () => {
    expect(dailyToRows([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// weeklyToRows — WeeklyRecord[] → plain object 배열 변환
// ---------------------------------------------------------------------------

describe('weeklyToRows — WeeklyRecord 변환', () => {
  const records: WeeklyRecord[] = [
    { week: '2월 1주차', revenue: 3000000, profit: 200000, usageHours: 40, usageCount: 25, utilizationRate: 75, weeklyTarget: 5000000, revenuePerCar: 0, usageCountPerCar: 0, usageHoursPerCar: 0 },
    { week: '2월 2주차', revenue: 4000000, profit: 300000, usageHours: 45, usageCount: 28, utilizationRate: 82, weeklyTarget: 5000000, revenuePerCar: 0, usageCountPerCar: 0, usageHoursPerCar: 0 },
  ];

  it('입력 레코드 수와 동일한 행 수를 반환한다', () => {
    expect(weeklyToRows(records)).toHaveLength(2);
  });

  it('첫 번째 행의 키 목록이 올바르다 (주차,매출,대당매출,손익,대당이용시간,대당이용건수,가동률,목표)', () => {
    const rows = weeklyToRows(records);
    const keys = Object.keys(rows[0]);
    expect(keys).toEqual(['주차', '매출', '대당 매출', '손익', '대당 이용시간', '대당 이용건수', '가동률', '목표']);
  });

  it('주차 필드 값이 원본 week 문자열과 동일하다', () => {
    const rows = weeklyToRows(records);
    expect(rows[0]['주차']).toBe('2월 1주차');
    expect(rows[1]['주차']).toBe('2월 2주차');
  });

  it('목표 필드가 weeklyTarget 원본 숫자와 동일하다', () => {
    const rows = weeklyToRows(records);
    expect(rows[0]['목표']).toBe(5000000);
  });

  it('빈 배열을 전달하면 빈 배열을 반환한다', () => {
    expect(weeklyToRows([])).toHaveLength(0);
  });
});
