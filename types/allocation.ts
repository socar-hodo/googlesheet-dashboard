// 신차 배분 시스템 타입 정의

/** 배분 모드 */
export type AllocationMode = "region1" | "region2";

/** 폼 입력 파라미터 */
export interface AllocationParams {
  carModel: string;    // 차종 모델명 (예: 아반떼) — 빈 문자열이면 세그먼트 기준만 사용
  carSegment: string;  // 세그먼트 (예: 준중형)
  totalCars: number;   // 총 배분 물량
  baseDate: string;    // 기준 날짜 (YYYY-MM-DD)
  mode?: AllocationMode; // 배분 모드 (기본: region1)
  region1List?: string[]; // 2단계 모드 시 대상 광역 (복수 선택)
}

/** 배분 대상 광역 목록 (제주 제외) */
export const REGION1_LIST = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시",
  "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원특별자치도", "충청북도", "충청남도",
  "전북특별자치도", "전라남도", "경상북도", "경상남도",
] as const;

/** BigQuery 결과 한 행 */
export interface AllocationRow {
  region1: string;
  region2: string;
  ref_type: "model" | "segment" | "fallback";
  final_score: number;
  rev_yoy: number | null;
  util_yoy: number | null;
  allocated_cars: number;
  is_equal_dist: boolean; // 점수 합계 0 → 균등 배분 적용 여부
  score_s1: number;  // α=0.3 (가동률 중시)
  score_s2: number;  // α=0.4
  score_s3: number;  // α=0.5 (채택값)
  score_s4: number;  // α=0.6
  score_s5: number;  // α=0.7 (수익 중시)
  rank_s1: number;   // α=0.3 기준 순위
  rank_s5: number;   // α=0.7 기준 순위
}

/** /api/allocation/run 성공 응답 */
export interface AllocationResult {
  rows: AllocationRow[];
  spearman: number | null;
  totalAllocated: number;
  region1Count: number;
  region2Count: number;
  mode: AllocationMode;
}

/** /api/allocation/run 에러 응답 */
export interface AllocationError {
  errors: string[];
}

/** 민감도 분석 α값과 score 컬럼 대응 관계 */
export const ALPHA_SCORE_MAP = [
  { alpha: 0.3, key: "score_s1" as const, label: "α=0.3" },
  { alpha: 0.4, key: "score_s2" as const, label: "α=0.4" },
  { alpha: 0.5, key: "score_s3" as const, label: "α=0.5 ★" },
  { alpha: 0.6, key: "score_s4" as const, label: "α=0.6" },
  { alpha: 0.7, key: "score_s5" as const, label: "α=0.7" },
] as const;

export const SEGMENTS = [
  "준중형", "중형", "중형SUV", "준대형", "준대형SUV",
  "소형SUV", "경형", "승합", "EV", "수입", "RV",
] as const;

export type Segment = typeof SEGMENTS[number];

/** CSV 출력 컬럼 목록 (순서 보존) */
export const CSV_HEADERS: (keyof AllocationRow)[] = [
  "region1", "region2", "ref_type", "final_score",
  "rev_yoy", "util_yoy", "allocated_cars",
  "score_s1", "score_s2", "score_s3", "score_s4", "score_s5",
  "rank_s1", "rank_s5",
];
