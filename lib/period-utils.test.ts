// 기간 필터 유틸리티 — 단위 테스트 (TDD Red 단계)
import { describe, it, expect } from 'vitest';
import {
  PeriodKey,
  DateRange,
  DAILY_PERIODS,
  WEEKLY_PERIODS,
  PERIOD_LABELS,
  DEFAULT_DAILY_PERIOD,
  DEFAULT_WEEKLY_PERIOD,
  getDateRange,
  filterDailyByPeriod,
  filterWeeklyByPeriod,
  parseWeekMonth,
} from './period-utils';
import type { DailyRecord, WeeklyRecord } from '../types/dashboard';

// ---------------------------------------------------------------------------
// 상수 및 타입 검증
// ---------------------------------------------------------------------------

describe('상수 — DAILY_PERIODS', () => {
  it('4개의 값이 있다', () => {
    expect(DAILY_PERIODS).toHaveLength(4);
  });

  it('올바른 PeriodKey 값을 포함한다', () => {
    expect(DAILY_PERIODS).toEqual(['this-week', 'last-week', 'this-month', 'last-month']);
  });
});

describe('상수 — WEEKLY_PERIODS', () => {
  it('2개의 값이 있다', () => {
    expect(WEEKLY_PERIODS).toHaveLength(2);
  });

  it('올바른 PeriodKey 값을 포함한다', () => {
    expect(WEEKLY_PERIODS).toEqual(['this-month', 'last-month']);
  });
});

describe('상수 — PERIOD_LABELS', () => {
  it('모든 PeriodKey에 대한 한국어 레이블이 있다', () => {
    expect(PERIOD_LABELS['this-week']).toBeDefined();
    expect(PERIOD_LABELS['last-week']).toBeDefined();
    expect(PERIOD_LABELS['this-month']).toBeDefined();
    expect(PERIOD_LABELS['last-month']).toBeDefined();
  });
});

describe('상수 — 기본값', () => {
  it('DEFAULT_DAILY_PERIOD이 DAILY_PERIODS에 포함된다', () => {
    expect(DAILY_PERIODS).toContain(DEFAULT_DAILY_PERIOD);
  });

  it('DEFAULT_WEEKLY_PERIOD이 WEEKLY_PERIODS에 포함된다', () => {
    expect(WEEKLY_PERIODS).toContain(DEFAULT_WEEKLY_PERIOD);
  });
});

// ---------------------------------------------------------------------------
// getDateRange — 날짜 범위 계산
// ---------------------------------------------------------------------------

describe('getDateRange — this-week', () => {
  it('수요일(2026-03-04) 기준 — 그 주 월요일(02)부터 오늘까지', () => {
    const result = getDateRange('this-week', new Date('2026-03-04'));
    expect(result).toEqual({ start: '2026-03-02', end: '2026-03-04' });
  });

  it('일요일(2026-03-01) 기준 — 지난 월요일(02-23)부터 오늘까지', () => {
    const result = getDateRange('this-week', new Date('2026-03-01'));
    expect(result).toEqual({ start: '2026-02-23', end: '2026-03-01' });
  });

  it('월요일(2026-03-02) 기준 — 당일이 start이고 end도 당일', () => {
    const result = getDateRange('this-week', new Date('2026-03-02'));
    expect(result).toEqual({ start: '2026-03-02', end: '2026-03-02' });
  });
});

describe('getDateRange — last-week', () => {
  it('수요일(2026-03-04) 기준 — 전주 월(02-23)부터 전주 일(03-01)까지', () => {
    const result = getDateRange('last-week', new Date('2026-03-04'));
    expect(result).toEqual({ start: '2026-02-23', end: '2026-03-01' });
  });
});

describe('getDateRange — this-month', () => {
  it('2026-03-04 기준 — 3월 1일부터 오늘까지', () => {
    const result = getDateRange('this-month', new Date('2026-03-04'));
    expect(result).toEqual({ start: '2026-03-01', end: '2026-03-04' });
  });
});

describe('getDateRange — last-month', () => {
  it('2026-03-04 기준 — 2월 1일부터 2월 28일까지', () => {
    const result = getDateRange('last-month', new Date('2026-03-04'));
    expect(result).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('2026-01-15 기준 — 전년 12월 1일부터 31일까지', () => {
    const result = getDateRange('last-month', new Date('2026-01-15'));
    expect(result).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
});

// ---------------------------------------------------------------------------
// filterDailyByPeriod — DailyRecord 배열 필터링
// ---------------------------------------------------------------------------

describe('filterDailyByPeriod', () => {
  const records: DailyRecord[] = [
    { date: '2026-03-01', revenue: 1000, profit: 100, usageHours: 8, usageCount: 5, utilizationRate: 80 },
    { date: '2026-03-02', revenue: 2000, profit: 200, usageHours: 9, usageCount: 6, utilizationRate: 85 },
    { date: '2026-03-05', revenue: 3000, profit: 300, usageHours: 7, usageCount: 4, utilizationRate: 70 },
  ];

  it('범위 내 레코드만 반환한다 (2026-03-01 ~ 2026-03-03)', () => {
    const result = filterDailyByPeriod(records, { start: '2026-03-01', end: '2026-03-03' });
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-03-01');
    expect(result[1].date).toBe('2026-03-02');
  });

  it('정확히 start/end 날짜를 포함한다 (inclusive)', () => {
    const result = filterDailyByPeriod(records, { start: '2026-03-01', end: '2026-03-05' });
    expect(result).toHaveLength(3);
  });

  it('범위를 벗어난 레코드는 제외한다', () => {
    const result = filterDailyByPeriod(records, { start: '2026-03-10', end: '2026-03-20' });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseWeekMonth — 주차 문자열에서 월 파싱
// ---------------------------------------------------------------------------

describe('parseWeekMonth', () => {
  it('"2월 3주차"에서 2를 반환한다', () => {
    expect(parseWeekMonth('2월 3주차')).toBe(2);
  });

  it('"1월 1주차"에서 1을 반환한다', () => {
    expect(parseWeekMonth('1월 1주차')).toBe(1);
  });

  it('"3주차" (월 없음)에서 null을 반환한다', () => {
    expect(parseWeekMonth('3주차')).toBeNull();
  });

  it('빈 문자열에서 null을 반환한다', () => {
    expect(parseWeekMonth('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// filterWeeklyByPeriod — WeeklyRecord 배열 필터링
// ---------------------------------------------------------------------------

describe('filterWeeklyByPeriod', () => {
  const records: WeeklyRecord[] = [
    { week: '2월 1주차', revenue: 1000, profit: 100, usageHours: 8, usageCount: 5, utilizationRate: 80, weeklyTarget: 5000 },
    { week: '2월 2주차', revenue: 2000, profit: 200, usageHours: 9, usageCount: 6, utilizationRate: 85, weeklyTarget: 5000 },
    { week: '3월 1주차', revenue: 3000, profit: 300, usageHours: 7, usageCount: 4, utilizationRate: 70, weeklyTarget: 5000 },
    { week: '3월 2주차', revenue: 4000, profit: 400, usageHours: 10, usageCount: 7, utilizationRate: 90, weeklyTarget: 5000 },
  ];

  it('this-month: 2026-03-04 기준 3월 레코드만 반환한다', () => {
    const result = filterWeeklyByPeriod(records, 'this-month', new Date('2026-03-04'));
    expect(result).toHaveLength(2);
    expect(result[0].week).toBe('3월 1주차');
    expect(result[1].week).toBe('3월 2주차');
  });

  it('last-month: 2026-03-04 기준 2월 레코드만 반환한다', () => {
    const result = filterWeeklyByPeriod(records, 'last-month', new Date('2026-03-04'));
    expect(result).toHaveLength(2);
    expect(result[0].week).toBe('2월 1주차');
    expect(result[1].week).toBe('2월 2주차');
  });

  it('월 파싱 불가 레코드(예: "1주차")가 있으면 전체를 반환한다', () => {
    const unparseable: WeeklyRecord[] = [
      { week: '1주차', revenue: 1000, profit: 100, usageHours: 8, usageCount: 5, utilizationRate: 80, weeklyTarget: 5000 },
      { week: '2주차', revenue: 2000, profit: 200, usageHours: 9, usageCount: 6, utilizationRate: 85, weeklyTarget: 5000 },
    ];
    const result = filterWeeklyByPeriod(unparseable, 'this-month', new Date('2026-03-04'));
    expect(result).toHaveLength(2);
  });

  it('last-month: 2026-01-15 기준 이전 연도 12월 레코드를 반환한다', () => {
    const decRecords: WeeklyRecord[] = [
      { week: '11월 3주차', revenue: 1000, profit: 100, usageHours: 8, usageCount: 5, utilizationRate: 80, weeklyTarget: 5000 },
      { week: '12월 1주차', revenue: 2000, profit: 200, usageHours: 9, usageCount: 6, utilizationRate: 85, weeklyTarget: 5000 },
    ];
    const result = filterWeeklyByPeriod(decRecords, 'last-month', new Date('2026-01-15'));
    expect(result).toHaveLength(1);
    expect(result[0].week).toBe('12월 1주차');
  });
});
