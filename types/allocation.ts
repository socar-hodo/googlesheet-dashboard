// 신차 배분 시스템 타입 정의

/** 폼 입력 파라미터 */
export interface AllocationParams {
  carModel: string;    // 차종 모델명 (예: 아반떼)
  carSegment: string;  // 세그먼트 (예: 준중형)
  totalCars: number;   // 총 배분 물량
  baseDate: string;    // 기준 날짜 (YYYY-MM-DD)
}

/** BigQuery 결과 한 행 */
export interface AllocationRow {
  region1: string;
  region2: string;
  ref_type: "model" | "segment" | "fallback";
  final_score: number;
  rev_yoy: number | null;
  util_yoy: number | null;
  allocated_cars: number;
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
