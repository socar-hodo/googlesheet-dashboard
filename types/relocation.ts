// 차량 재배치 의사결정 도구 — 타입 정의

export const PAST_DAYS_OPTIONS = [7, 14, 30] as const;
export const FUTURE_DAYS_OPTIONS = [3, 7, 14] as const;

export interface RelocationParams {
  region1: string;       // "전체" 또는 특정 시/도
  pastDays: 7 | 14 | 30;
  futureDays: 3 | 7 | 14;
  weights: {
    utilization: number;     // α (0~1)
    revenue: number;         // β (0~1)
    prereservation: number;  // γ (0~1), 합계 = 1.0
  };
}

export interface RelocationRow {
  region1: string;
  region2: string;
  utilRate: number;        // 가동률 (0~1)
  revPerCar: number;       // 대당매출 (원)
  prereservRate: number;   // 사전예약률 (0~1)
  carCount: number;        // 차량 수 (past_operation 기준)
  score: number;           // 복합 스코어 (0~1)
  tier: "top" | "mid" | "bottom";  // 상위20% / 중간 / 하위20%
}

export interface RelocationRecommendation {
  fromZone: string;    // 송출 존 (region2)
  fromRegion1: string; // 송출 시/도 (region1)
  toZone: string;      // 수신 존 (region2)
  toRegion1: string;   // 수신 시/도 (region1)
  carCount: number;    // 권장 이동 대수 (최소 1)
  sameRegion: boolean; // 동일 region1 여부
}

export interface RelocationCarCandidate {
  carId: number;
  carName: string;
  carNum: string;
  region1: string;
  region2: string;
  utilRate: number | null; // 과거 N일 가동률 (낮을수록 재배치 우선)
}

export interface RelocationResult {
  rows: RelocationRow[];
  recommendations: RelocationRecommendation[];
  fetchedAt: string;   // ISO 8601
}

export interface RelocationError {
  errors: string[];
}
