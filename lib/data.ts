// 경남울산사업팀 매출 대시보드 — 데이터 페칭 및 파싱 레이어
import type { DailyRecord, WeeklyRecord, TeamDashboardData, CustomerTypeRow, RevenueBreakdownRow, CostBreakdownRow } from "@/types/dashboard";
import { fetchSheetData, isGoogleSheetsConfigured } from "./sheets";
import { mockTeamDashboardData } from "./mock-data";

// 실제 Google Sheets 탭 이름 — 환경변수로 재정의 가능 (PITFALLS.md Pitfall 2 대응)
const DAILY_SHEET = process.env.GOOGLE_DAILY_SHEET_NAME ?? "일별";
const WEEKLY_SHEET = process.env.GOOGLE_WEEKLY_SHEET_NAME ?? "주차별";
// [d] raw / [w] raw — 매출세분화 + 비용분석 전용 시트
// 시트명에 대괄호 특수문자 포함 → fetchSheetData 호출 시 단일 따옴표로 감싸야 한다
const DAILY_RAW_SHEET = process.env.GOOGLE_DAILY_RAW_SHEET_NAME ?? "[d] raw";
const WEEKLY_RAW_SHEET = process.env.GOOGLE_WEEKLY_RAW_SHEET_NAME ?? "[w] raw";

// 헤더 이름 상수 — 실제 Google Sheets 2행 컬럼명과 일치해야 한다
// 1행: 컬럼 문자 식별자, 2행: 실제 헤더, 3행~: 데이터
const DAILY_HEADERS = {
  date: "일자",
  revenue: "회계매출",
  profit: "손익",
  usageHours: "이용시간",
  usageCount: "이용건수",
  utilizationRate: "가동률",
} as const;

const WEEKLY_HEADERS = {
  week: "주차",
  revenue: "회계매출",
  profit: "손익",
  usageHours: "이용시간",
  usageCount: "이용건수",
  utilizationRate: "가동률",
  weeklyTarget: "매출 목표",
} as const;

// 고객 유형 헤더 — 기존 일별/주차별 시트에 있는 컬럼
const CUSTOMER_TYPE_HEADERS = {
  roundTrip: "왕복_건수",
  call: "부름_건수",
  oneWay: "편도_건수",
} as const;

// [d] raw / [w] raw 시트 매출 세분화 헤더
const RAW_REVENUE_HEADERS = {
  date: "일자",
  rental: "대여매출",
  pf: "PF매출",
  driving: "주행매출",
  call: "부름매출",
  other: "기타매출",
} as const;

// [d] raw / [w] raw 시트 비용 분석 헤더
const RAW_COST_HEADERS = {
  date: "일자",
  transport: "운반비",
  fuel: "유류비",
  parking: "주차료",
  inspection: "점검비",
  depreciation: "감가상각비",
  commission: "수수료",
  chargeTransport: "충전운반비",
  callTransport: "부름운반비",
  zoneOneWayTransport: "존편도운반비",
} as const;

// --- 유틸리티 함수 ---

/** 헤더 배열을 받아 헤더명 → 인덱스 Map을 반환한다. 빈 헤더 셀은 추가하지 않는다. */
function buildColumnIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const trimmed = header.trim();
    if (trimmed !== "") {
      map.set(trimmed, index);
    }
  });
  return map;
}

/**
 * 한국어 숫자 문자열을 파싱하여 숫자로 변환한다. (DATA-03 핵심)
 * - undefined, null, 빈 문자열 → 0 반환
 * - ₩ 기호, % 기호, 콤마(,) 제거 후 Number() 변환
 * - 변환 결과가 NaN이면 console.warn 후 null 반환
 */
export function parseKoreanNumber(value: string | null | undefined): number | null {
  // 빈 값 처리 (undefined, null, 빈 문자열, "-" 대시 표기 모두 0)
  if (value === undefined || value === null || value === "" || value.trim() === "-") {
    return 0;
  }

  // 전처리: 공백 제거 → ₩ 제거 → % 제거 → 콤마 제거
  const cleaned = value
    .trim()
    .replace(/₩/g, "")
    .replace(/%/g, "")
    .replace(/,/g, "");

  const result = Number(cleaned);

  if (Number.isNaN(result)) {
    console.warn(`[parseKoreanNumber] 변환 불가 값: "${value}"`);
    return null;
  }

  return result;
}

/** parseKoreanNumber 결과가 null이면 fallback(기본 0)을 반환한다. */
function safeNumber(value: string | null | undefined, fallback: number = 0): number {
  const parsed = parseKoreanNumber(value);
  return parsed === null ? fallback : parsed;
}

// --- 시트 파서 ---

/**
 * Google Sheets 날짜 문자열을 ISO YYYY-MM-DD 형식으로 정규화한다.
 * - "2026-02-21" → "2026-02-21" (이미 ISO, 그대로 반환)
 * - "2026. 2. 21" → "2026-02-21" (한국어 점 구분 형식 변환)
 * filterDailyByPeriod는 문자열 사전순 비교를 사용하므로 ISO 형식이 필수.
 */
function normalizeDateToISO(date: string): string {
  const trimmed = date.trim();
  if (trimmed.includes('-')) return trimmed; // 이미 ISO 형식
  // "YYYY. M. D" 또는 "YYYY. MM. DD" 형식 처리
  const parts = trimmed.split('.').map((s) => s.trim()).filter((s) => s !== '');
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return trimmed; // 파싱 불가 시 원본 반환
}

/**
 * Daily 시트 raw 데이터를 DailyRecord 배열로 파싱한다. (DATA-01)
 * 헤더 이름 기반 컬럼 매핑을 사용하여 시트 구조 변경에 강건하다.
 */
function parseDailySheet(rows: string[][]): DailyRecord[] {
  // rows[0] = 1행(컬럼 식별자), rows[1] = 2행(헤더), rows[2]~ = 데이터
  if (rows.length < 3) return [];

  const colIndex = buildColumnIndex(rows[1]);

  // 필수 헤더가 없으면 경고
  for (const [, headerName] of Object.entries(DAILY_HEADERS)) {
    if (!colIndex.has(headerName)) {
      console.warn(`[parseDailySheet] 헤더를 찾을 수 없음: "${headerName}"`);
    }
  }

  const getCell = (row: string[], headerName: string): string | undefined => {
    const idx = colIndex.get(headerName);
    return idx !== undefined ? row[idx] : undefined;
  };

  // 일자 컬럼이 비어있는 행 제거 (미입력 trailing 행, 합계 행 등 방지)
  const dateIdx = colIndex.get(DAILY_HEADERS.date) ?? -1;
  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): DailyRecord => ({
      date: normalizeDateToISO((getCell(row, DAILY_HEADERS.date) ?? "").trim()),
      revenue: safeNumber(getCell(row, DAILY_HEADERS.revenue)),
      profit: safeNumber(getCell(row, DAILY_HEADERS.profit)),
      usageHours: safeNumber(getCell(row, DAILY_HEADERS.usageHours)),
      usageCount: safeNumber(getCell(row, DAILY_HEADERS.usageCount)),
      utilizationRate: safeNumber(getCell(row, DAILY_HEADERS.utilizationRate)),
    }));
}

/**
 * Weekly 시트 raw 데이터를 WeeklyRecord 배열로 파싱한다. (DATA-02)
 * weeklyTarget 필드를 포함하여 WeeklyRecord 객체를 생성한다.
 */
function parseWeeklySheet(rows: string[][]): WeeklyRecord[] {
  // rows[0] = 1행(컬럼 식별자), rows[1] = 2행(헤더), rows[2]~ = 데이터
  if (rows.length < 3) return [];

  const colIndex = buildColumnIndex(rows[1]);

  // 필수 헤더가 없으면 경고
  for (const [, headerName] of Object.entries(WEEKLY_HEADERS)) {
    if (!colIndex.has(headerName)) {
      console.warn(`[parseWeeklySheet] 헤더를 찾을 수 없음: "${headerName}"`);
    }
  }

  const getCell = (row: string[], headerName: string): string | undefined => {
    const idx = colIndex.get(headerName);
    return idx !== undefined ? row[idx] : undefined;
  };

  // 주차 컬럼이 비어있는 행 제거 (미입력 trailing 행 방지)
  const weekIdx = colIndex.get(WEEKLY_HEADERS.week) ?? -1;
  return rows
    .slice(2)
    .filter((row) => (row[weekIdx] ?? "").trim() !== "")
    .map((row): WeeklyRecord => ({
      week: (getCell(row, WEEKLY_HEADERS.week) ?? "").trim(),
      revenue: safeNumber(getCell(row, WEEKLY_HEADERS.revenue)),
      profit: safeNumber(getCell(row, WEEKLY_HEADERS.profit)),
      usageHours: safeNumber(getCell(row, WEEKLY_HEADERS.usageHours)),
      usageCount: safeNumber(getCell(row, WEEKLY_HEADERS.usageCount)),
      utilizationRate: safeNumber(getCell(row, WEEKLY_HEADERS.utilizationRate)),
      weeklyTarget: safeNumber(getCell(row, WEEKLY_HEADERS.weeklyTarget)),
    }));
}

/**
 * 일별 또는 주차별 시트 rows에서 고객 유형 건수를 파싱한다.
 * @param rows - Google Sheets raw 2D 배열 (rows[0]=식별자, rows[1]=헤더, rows[2~]=데이터)
 * @param dateFieldName - 날짜/주차 구분 헤더명 ("일자" 또는 "주차")
 */
export function parseCustomerTypeFromRows(
  rows: string[][],
  dateFieldName: string
): CustomerTypeRow[] {
  if (rows.length < 3) return [];
  const colIndex = buildColumnIndex(rows[1]);

  const getCell = (row: string[], h: string): string | undefined => {
    const idx = colIndex.get(h);
    return idx !== undefined ? row[idx] : undefined;
  };

  // 누락 헤더 경고
  for (const [, headerName] of Object.entries(CUSTOMER_TYPE_HEADERS)) {
    if (!colIndex.has(headerName)) {
      console.warn(`[parseCustomerTypeFromRows] 헤더를 찾을 수 없음: "${headerName}"`);
    }
  }

  const dateIdx = colIndex.get(dateFieldName) ?? -1;
  const isDaily = dateFieldName === "일자";

  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): CustomerTypeRow => ({
      ...(isDaily
        ? { date: normalizeDateToISO((getCell(row, "일자") ?? "").trim()) }
        : { week: (getCell(row, "주차") ?? "").trim() }),
      roundTripCount: safeNumber(getCell(row, CUSTOMER_TYPE_HEADERS.roundTrip)),
      callCount: safeNumber(getCell(row, CUSTOMER_TYPE_HEADERS.call)),
      oneWayCount: safeNumber(getCell(row, CUSTOMER_TYPE_HEADERS.oneWay)),
    }));
}

/**
 * [d] raw 또는 [w] raw 시트 rows에서 매출 세분화 데이터를 파싱한다.
 * 2행 헤더 구조 (rows[0]=식별자, rows[1]=헤더, rows[2~]=데이터).
 */
export function parseRevenueBreakdownFromRaw(rows: string[][]): RevenueBreakdownRow[] {
  if (rows.length < 3) return [];
  const colIndex = buildColumnIndex(rows[1]);

  const getCell = (row: string[], h: string): string | undefined => {
    const idx = colIndex.get(h);
    return idx !== undefined ? row[idx] : undefined;
  };

  // 누락 헤더 경고
  for (const [, headerName] of Object.entries(RAW_REVENUE_HEADERS)) {
    if (!colIndex.has(headerName)) {
      console.warn(`[parseRevenueBreakdownFromRaw] 헤더를 찾을 수 없음: "${headerName}"`);
    }
  }

  const dateIdx = colIndex.get(RAW_REVENUE_HEADERS.date) ?? -1;
  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): RevenueBreakdownRow => ({
      date: normalizeDateToISO((getCell(row, RAW_REVENUE_HEADERS.date) ?? "").trim()),
      rentalRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.rental)),
      pfRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.pf)),
      drivingRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.driving)),
      callRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.call)),
      otherRevenue: safeNumber(getCell(row, RAW_REVENUE_HEADERS.other)),
    }));
}

/**
 * [d] raw 또는 [w] raw 시트 rows에서 비용 분석 데이터를 파싱한다.
 * 카테고리 합계 + 드릴다운 세부 컬럼(충전/부름/존편도 운반비)을 포함한다.
 */
export function parseCostBreakdownFromRaw(rows: string[][]): CostBreakdownRow[] {
  if (rows.length < 3) return [];
  const colIndex = buildColumnIndex(rows[1]);

  const getCell = (row: string[], h: string): string | undefined => {
    const idx = colIndex.get(h);
    return idx !== undefined ? row[idx] : undefined;
  };

  // 누락 헤더 경고 (드릴다운 컬럼은 없을 수도 있으므로 카테고리 합계만 필수 경고)
  const requiredHeaders = [RAW_COST_HEADERS.date, RAW_COST_HEADERS.transport, RAW_COST_HEADERS.fuel];
  for (const headerName of requiredHeaders) {
    if (!colIndex.has(headerName)) {
      console.warn(`[parseCostBreakdownFromRaw] 헤더를 찾을 수 없음: "${headerName}"`);
    }
  }

  const dateIdx = colIndex.get(RAW_COST_HEADERS.date) ?? -1;
  return rows
    .slice(2)
    .filter((row) => (row[dateIdx] ?? "").trim() !== "")
    .map((row): CostBreakdownRow => ({
      date: normalizeDateToISO((getCell(row, RAW_COST_HEADERS.date) ?? "").trim()),
      transportCost: safeNumber(getCell(row, RAW_COST_HEADERS.transport)),
      fuelCost: safeNumber(getCell(row, RAW_COST_HEADERS.fuel)),
      parkingCost: safeNumber(getCell(row, RAW_COST_HEADERS.parking)),
      inspectionCost: safeNumber(getCell(row, RAW_COST_HEADERS.inspection)),
      depreciationCost: safeNumber(getCell(row, RAW_COST_HEADERS.depreciation)),
      commissionCost: safeNumber(getCell(row, RAW_COST_HEADERS.commission)),
      chargeTransportCost: safeNumber(getCell(row, RAW_COST_HEADERS.chargeTransport)),
      callTransportCost: safeNumber(getCell(row, RAW_COST_HEADERS.callTransport)),
      zoneOneWayTransportCost: safeNumber(getCell(row, RAW_COST_HEADERS.zoneOneWayTransport)),
    }));
}

// --- 통합 데이터 페칭 함수 ---

/**
 * 팀 대시보드 전체 데이터를 가져온다. (DATA-04, UX-02)
 *
 * - Google Sheets 환경변수 미설정 → mockTeamDashboardData 즉시 반환
 * - Google Sheets 설정됨 → 두 시트를 병렬 fetch
 *   - 개별 시트 null 반환 시 해당 mock 배열로 대체 (per-sheet fallback)
 *   - catch: 전체 API 실패 시 mockTeamDashboardData로 폴백 (fetchedAt은 현재 시각)
 *
 * googleapis SDK는 Next.js fetch 캐싱을 사용하지 않으므로
 * 기본적으로 매 요청마다 새로 실행된다. (UX-02 대응)
 */
export async function getTeamDashboardData(): Promise<TeamDashboardData> {
  // 환경변수 미설정 시 mock 데이터 즉시 반환
  if (!isGoogleSheetsConfigured()) {
    return mockTeamDashboardData;
  }

  try {
    // 네 시트를 병렬 fetch — [d] raw / [w] raw는 특수문자 시트명이므로 단일 따옴표로 감싼다
    const [dailyRows, weeklyRows, dailyRawRows, weeklyRawRows] = await Promise.all([
      fetchSheetData(`${DAILY_SHEET}!A1:DZ`),
      fetchSheetData(`${WEEKLY_SHEET}!A1:DZ`),
      fetchSheetData(`'${DAILY_RAW_SHEET}'!A1:DZ`),
      fetchSheetData(`'${WEEKLY_RAW_SHEET}'!A1:DZ`),
    ]);

    // 개별 시트 실패 시 해당 mock 배열로 대체
    const daily = dailyRows ? parseDailySheet(dailyRows) : mockTeamDashboardData.daily;
    const weekly = weeklyRows ? parseWeeklySheet(weeklyRows) : mockTeamDashboardData.weekly;

    // 고객 유형: 기존 일별/주차별 시트에서 파싱 (추가 fetch 없이 재활용)
    const customerTypeDaily = dailyRows
      ? parseCustomerTypeFromRows(dailyRows, "일자")
      : mockTeamDashboardData.customerTypeDaily;
    const customerTypeWeekly = weeklyRows
      ? parseCustomerTypeFromRows(weeklyRows, "주차")
      : mockTeamDashboardData.customerTypeWeekly;

    // 매출 세분화: [d] raw / [w] raw 시트에서 파싱
    const revenueBreakdownDaily = dailyRawRows
      ? parseRevenueBreakdownFromRaw(dailyRawRows)
      : mockTeamDashboardData.revenueBreakdownDaily;
    const revenueBreakdownWeekly = weeklyRawRows
      ? parseRevenueBreakdownFromRaw(weeklyRawRows)
      : mockTeamDashboardData.revenueBreakdownWeekly;

    // 비용 분석: [d] raw / [w] raw 시트에서 파싱
    const costBreakdownDaily = dailyRawRows
      ? parseCostBreakdownFromRaw(dailyRawRows)
      : mockTeamDashboardData.costBreakdownDaily;
    const costBreakdownWeekly = weeklyRawRows
      ? parseCostBreakdownFromRaw(weeklyRawRows)
      : mockTeamDashboardData.costBreakdownWeekly;

    return {
      daily,
      weekly,
      customerTypeDaily,
      customerTypeWeekly,
      revenueBreakdownDaily,
      revenueBreakdownWeekly,
      costBreakdownDaily,
      costBreakdownWeekly,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Google Sheets 데이터 가져오기 실패, mock 데이터로 전체 폴백:", error);
    // API 실패 시 전체 mock 폴백, fetchedAt은 현재 시각 사용
    return {
      ...mockTeamDashboardData,
      fetchedAt: new Date().toISOString(),
    };
  }
}
