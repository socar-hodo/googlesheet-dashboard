// export-utils — CSV/Excel 내보내기 순수 함수 라이브러리
// 'use client' 불필요 — 함수 실행은 클라이언트 이벤트 핸들러에서 이루어지며,
// 라이브러리 파일 자체는 서버에서도 import될 수 있다.
import { utils, writeFile } from 'xlsx';
import type { DailyRecord, WeeklyRecord } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// 내부 헬퍼 함수 (테스트를 위해 export)
// ---------------------------------------------------------------------------

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환한다 (로컬 시간 기준).
 * Date.toISOString()은 UTC 기준이라 한국 시간 자정 이전 날짜 오류 발생 — period-utils.ts의 toISODate와 동일 이유.
 * @param d - 변환할 Date (기본값: 현재 날짜)
 */
export function toDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * CSV 필드를 RFC 4180 규격에 맞게 이스케이프한다.
 * - 콤마(,), 큰따옴표("), 줄바꿈(\n, \r) 포함 시 따옴표로 감싼다.
 * - 필드 내 큰따옴표는 ""로 이스케이프한다.
 * - null/undefined는 빈 문자열로 변환한다.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // 특수문자가 없으면 그대로 반환
  if (!str.includes(',') && !str.includes('"') && !str.includes('\n') && !str.includes('\r')) {
    return str;
  }
  // 큰따옴표 이스케이프 후 전체를 따옴표로 감싼다
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * DailyRecord 배열을 내보내기용 plain object 배열로 변환한다.
 * 컬럼 순서: 날짜, 매출, 손익, 이용시간, 이용건수, 가동률 (UI 표시 순서와 동일)
 * 숫자값은 포맷 없는 raw number — 데이터 처리 용이 (₩ 포맷 사용 금지)
 */
export function dailyToRows(records: DailyRecord[]): Record<string, unknown>[] {
  return records.map((r) => ({
    날짜: r.date,
    매출: r.revenue,
    '대당 매출': Math.round(r.revenuePerCar),
    손익: r.profit,
    '대당 이용시간': Number(r.usageHoursPerCar.toFixed(1)),
    '대당 이용건수': Number(r.usageCountPerCar.toFixed(1)),
    가동률: r.utilizationRate,
  }));
}

/**
 * WeeklyRecord 배열을 내보내기용 plain object 배열로 변환한다.
 * 컬럼: 주차, 매출, 대당 매출, 손익, 대당 이용시간, 대당 이용건수, 가동률
 */
export function weeklyToRows(records: WeeklyRecord[]): Record<string, unknown>[] {
  return records.map((r) => ({
    주차: r.week,
    매출: r.revenue,
    '대당 매출': Math.round(r.revenuePerCar),
    손익: r.profit,
    '대당 이용시간': Number(r.usageHoursPerCar.toFixed(1)),
    '대당 이용건수': Number(r.usageCountPerCar.toFixed(1)),
    가동률: r.utilizationRate,
  }));
}

// ---------------------------------------------------------------------------
// CSV 헤더 매핑 (tab별)
// ---------------------------------------------------------------------------

const DAILY_HEADERS = ['날짜', '매출', '대당 매출', '손익', '대당 이용시간', '대당 이용건수', '가동률'];

const WEEKLY_HEADERS = ['주차', '매출', '대당 매출', '손익', '대당 이용시간', '대당 이용건수', '가동률'];

// ---------------------------------------------------------------------------
// 공개 내보내기 함수
// ---------------------------------------------------------------------------

/**
 * DailyRecord[] 또는 WeeklyRecord[]를 CSV 파일로 내보낸다.
 * - UTF-8 BOM(\uFEFF) 포함 — Excel 한국어 깨짐 방지
 * - 파일명: {tab}-{YYYY-MM-DD}.csv (로컬 시간 기준)
 * - 빈 배열이면 아무 동작 없이 조기 반환
 * - URL.revokeObjectURL 호출로 메모리 누수 방지
 */
export function exportToCsv(
  records: DailyRecord[] | WeeklyRecord[],
  tab: 'daily' | 'weekly',
): void {
  if (records.length === 0) return;

  const rows = tab === 'daily'
    ? dailyToRows(records as DailyRecord[])
    : weeklyToRows(records as WeeklyRecord[]);

  const headers = tab === 'daily' ? DAILY_HEADERS : WEEKLY_HEADERS;

  // 헤더 행 + 데이터 행 조합
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) =>
      headers.map((h) => escapeCsvField(row[h])).join(',')
    ),
  ];

  // UTF-8 BOM + CSV 콘텐츠 결합
  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 임시 앵커 엘리먼트로 다운로드 트리거
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tab}-${toDateString()}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 메모리 누수 방지
  URL.revokeObjectURL(url);
}

/**
 * DailyRecord[] 또는 WeeklyRecord[]를 Excel(.xlsx) 파일로 내보낸다.
 * - SheetJS utils.json_to_sheet + writeFile 패턴
 * - 시트 이름: daily → '일별', weekly → '주차별'
 * - 파일명: {tab}-{YYYY-MM-DD}.xlsx (로컬 시간 기준)
 * - 빈 배열이면 아무 동작 없이 조기 반환
 */
export function exportToXlsx(
  records: DailyRecord[] | WeeklyRecord[],
  tab: 'daily' | 'weekly',
): void {
  if (records.length === 0) return;

  const rows = tab === 'daily'
    ? dailyToRows(records as DailyRecord[])
    : weeklyToRows(records as WeeklyRecord[]);

  const sheetName = tab === 'daily' ? '일별' : '주차별';

  // SheetJS: JSON 배열 → 워크시트 → 워크북 → 파일 다운로드
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);

  writeFile(wb, `${tab}-${toDateString()}.xlsx`);
}
