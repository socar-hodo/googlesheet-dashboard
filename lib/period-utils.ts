// 기간 필터 유틸리티 — 순수 함수 모음 (외부 의존성 없음)
import type { CustomerTypeRow, DailyRecord, WeeklyRecord } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** Daily 탭: 4가지 + custom, Weekly 탭: 2가지 기간 키 */
export type PeriodKey = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

/** 날짜 범위 — YYYY-MM-DD 형식 문자열 쌍 */
export interface DateRange {
  start: string; // 시작일 (포함)
  end: string;   // 종료일 (포함)
}

// ---------------------------------------------------------------------------
// 상수 정의
// ---------------------------------------------------------------------------

/** Daily 탭에서 사용 가능한 기간 목록 */
export const DAILY_PERIODS: PeriodKey[] = [
  'this-week',
  'last-week',
  'this-month',
  'last-month',
];

/** Weekly 탭에서 사용 가능한 기간 목록 (월 단위만) */
export const WEEKLY_PERIODS: PeriodKey[] = ['this-month', 'last-month'];

/** 기간 키 → 한국어 레이블 매핑 */
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  'this-week': '이번 주',
  'last-week': '지난 주',
  'this-month': '이번 달',
  'last-month': '지난 달',
  'custom': '직접 선택',
};

/** Daily 탭 기본 기간 */
export const DEFAULT_DAILY_PERIOD: PeriodKey = 'this-month';

/** Weekly 탭 기본 기간 */
export const DEFAULT_WEEKLY_PERIOD: PeriodKey = 'this-month';

// ---------------------------------------------------------------------------
// 내부 헬퍼 함수
// ---------------------------------------------------------------------------

/** Date 객체를 YYYY-MM-DD 문자열로 변환 (로컬 시간 기준) */
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 주어진 날짜가 속한 주의 월요일을 반환한다 (ISO 주차 기준: 월요일 시작).
 * 일요일(day=0)은 -6일, 그 외는 (1 - day)일을 더해 월요일로 이동.
 */
function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// ---------------------------------------------------------------------------
// 공개 함수
// ---------------------------------------------------------------------------

/**
 * 기간 키와 기준일(today)을 받아 해당 기간의 날짜 범위를 반환한다.
 * @param period - 기간 키
 * @param today  - 기준일 (기본값: 오늘)
 */
export function getDateRange(period: PeriodKey, today: Date = new Date(), customRange?: DateRange): DateRange {
  if (period === 'custom' && customRange) return customRange;

  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  switch (period) {
    case 'this-week': {
      // 이번 주: 이 주의 월요일 ~ 오늘
      const monday = getMonday(today);
      return { start: toISODate(monday), end: toISODate(today) };
    }

    case 'last-week': {
      // 지난 주: (이 주 월요일 - 7일) ~ (이 주 월요일 - 1일)
      const monday = getMonday(today);
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      const lastSunday = new Date(monday);
      lastSunday.setDate(monday.getDate() - 1);
      return { start: toISODate(lastMonday), end: toISODate(lastSunday) };
    }

    case 'this-month': {
      // 이번 달: 1일 ~ 오늘
      const firstDay = new Date(year, month, 1);
      return { start: toISODate(firstDay), end: toISODate(today) };
    }

    case 'last-month': {
      // 지난 달: 전월 1일 ~ 전월 말일
      // JS Date는 음수 month를 자동 처리: new Date(2026, -1, 1) = 2025-12-01
      const firstDay = new Date(year, month - 1, 1);
      // new Date(year, month, 0): 이번 달 0일 = 전월 말일
      const lastDay = new Date(year, month, 0);
      return { start: toISODate(firstDay), end: toISODate(lastDay) };
    }

    case 'custom': {
      // custom without range: fall back to this-month
      const firstDay = new Date(year, month, 1);
      return { start: toISODate(firstDay), end: toISODate(today) };
    }
  }
}

/**
 * DailyRecord 배열을 날짜 범위로 필터링한다.
 * 문자열 사전순 비교를 이용한다 (YYYY-MM-DD 형식이므로 날짜 순서와 동일).
 */
export function filterDailyByPeriod(records: DailyRecord[], range: DateRange): DailyRecord[] {
  return records.filter((r) => r.date >= range.start && r.date <= range.end);
}

/**
 * 증감 비교용 직전 기간을 반환한다.
 * - this-week  → 전주 (월-일, 7일)
 * - this-month → 전월 (1일-말일)
 * - last-week  → 전전주 (월-일)
 * - last-month → 전전월 (1일-말일)
 * - custom     → 같은 길이의 바로 직전 기간
 */
export function getPreviousRange(
  period: PeriodKey,
  currentRange: DateRange,
  today: Date = new Date(),
): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (period) {
    case 'this-week':
      return getDateRange('last-week', today);

    case 'this-month':
      return getDateRange('last-month', today);

    case 'last-week': {
      const monday = getMonday(today);
      const twoWeeksAgoMonday = new Date(monday);
      twoWeeksAgoMonday.setDate(monday.getDate() - 14);
      const twoWeeksAgoSunday = new Date(monday);
      twoWeeksAgoSunday.setDate(monday.getDate() - 8);
      return { start: toISODate(twoWeeksAgoMonday), end: toISODate(twoWeeksAgoSunday) };
    }

    case 'last-month': {
      const firstDay = new Date(year, month - 2, 1);
      const lastDay = new Date(year, month - 1, 0);
      return { start: toISODate(firstDay), end: toISODate(lastDay) };
    }

    case 'custom': {
      const startDate = new Date(currentRange.start + 'T00:00:00');
      const endDate = new Date(currentRange.end + 'T00:00:00');
      const lengthDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (lengthDays - 1));
      return { start: toISODate(prevStart), end: toISODate(prevEnd) };
    }
  }
}

/**
 * 주차 문자열에서 월 숫자를 파싱한다.
 * 예: "2월 3주차" → 2, "3주차" → null
 */
export function parseWeekMonth(week: string): number | null {
  const match = /^(\d+)월/.exec(week);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * WeeklyRecord 배열을 기간(이번 달/지난 달)으로 필터링한다.
 * - 월 파싱 가능한 레코드: 해당 월 데이터만 반환
 * - 월 파싱 불가능한 레코드가 하나라도 있으면: 전체를 그대로 반환 (폴백)
 * @param records - 필터링할 WeeklyRecord 배열
 * @param period  - 'this-month' | 'last-month'
 * @param today   - 기준일 (기본값: 오늘)
 */
export function filterWeeklyByPeriod(
  records: WeeklyRecord[],
  period: 'this-month' | 'last-month',
  today: Date = new Date(),
): WeeklyRecord[] {
  const currentMonth = today.getMonth() + 1; // 1-indexed (1~12)
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const targetMonth = period === 'this-month' ? currentMonth : lastMonth;

  // 파싱 불가 레코드가 있으면 전체 반환 (폴백)
  const hasUnparseable = records.some((r) => parseWeekMonth(r.week) === null);
  if (hasUnparseable) return records;

  // 목표 월에 해당하는 레코드만 반환
  return records.filter((r) => parseWeekMonth(r.week) === targetMonth);
}

/**
 * CustomerTypeRow 배열을 기간(이번 달/지난 달)으로 필터링한다.
 * filterWeeklyByPeriod와 동일한 로직 — week 필드 기준 월 파싱.
 * - 파싱 불가 레코드(week 없음 포함)가 하나라도 있으면: 전체 반환 (폴백)
 */
export function filterCustomerTypeWeekly(
  rows: CustomerTypeRow[],
  period: 'this-month' | 'last-month',
  today: Date = new Date(),
): CustomerTypeRow[] {
  const currentMonth = today.getMonth() + 1;
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const targetMonth = period === 'this-month' ? currentMonth : lastMonth;

  const hasUnparseable = rows.some((r) => !r.week || parseWeekMonth(r.week) === null);
  if (hasUnparseable) return rows;

  return rows.filter((r) => r.week !== undefined && parseWeekMonth(r.week) === targetMonth);
}

