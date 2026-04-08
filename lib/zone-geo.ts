/**
 * Zone 시뮬레이터 — 지리 계산 모듈
 * Ported from: zone-simulator/geo.py
 */

// 차량 1대당 월 비용 (KRW)
const COST_PER_CAR_MONTHLY = 9_500_000;

// 카니발리제이션 최대 거리 (m)
const CANNIBALIZATION_MAX_M = 500.0;

export interface ZoneCoord {
  id: number;
  name: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

export interface CannibalizationResult {
  zone_id: number;
  zone_name: string;
  distance_m: number;
  level: "danger" | "warning";
}

export interface DemandTransferInput {
  id: number;
  lat: number;
  lng: number;
  utilization: number;
  revenue_per_car: number;
  car_count: number;
  [key: string]: unknown;
}

export interface NearbyZoneForTransfer {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utilization: number;
  revenue_per_car: number;
  distance_m: number;
  [key: string]: unknown;
}

export interface TransferItem {
  zone_id: number;
  zone_name: string;
  absorption_pct: number;
}

export interface DemandTransferResult {
  transfers: TransferItem[];
  total_absorption_pct: number;
  churn_pct: number;
  cost_saved_monthly: number;
  churn_loss_monthly: number;
  net_effect_monthly: number;
}

/**
 * Haversine 공식으로 두 좌표 간 거리 계산 (미터 단위).
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 카니발리제이션 위험 체크.
 * - "danger": distance_m < threshold_m
 * - "warning": threshold_m <= distance_m < 500m
 * - 500m 이상은 제외
 * 결과는 distance_m 오름차순 정렬.
 */
export function checkCannibalization(
  lat: number,
  lng: number,
  zones: ZoneCoord[],
  thresholdM: number = 200,
): CannibalizationResult[] {
  const results: CannibalizationResult[] = [];
  for (const zone of zones) {
    const dist = haversine(lat, lng, zone.lat, zone.lng);
    if (dist >= CANNIBALIZATION_MAX_M) continue;
    const level = dist < thresholdM ? "danger" : "warning";
    results.push({
      zone_id: zone.id,
      zone_name: zone.name,
      distance_m: Math.round(dist * 10) / 10,
      level,
    });
  }
  results.sort((a, b) => a.distance_m - b.distance_m);
  return results;
}

/**
 * 존 폐쇄 시 수요 이전 추정.
 *
 * Inverse-distance weighting x capacity factor (1 - utilization) 로
 * 인근 존의 흡수율을 계산하고, 이탈/비용절감/순효과를 산출.
 */
export function estimateDemandTransfer(
  targetZone: DemandTransferInput,
  nearbyZones: NearbyZoneForTransfer[],
): DemandTransferResult {
  const carCount = targetZone.car_count || 0;
  const utilization = targetZone.utilization || 0;
  const revenuePerCar = targetZone.revenue_per_car || 0;

  const costSavedMonthly = carCount * COST_PER_CAR_MONTHLY;
  const targetMonthlyRevenue = revenuePerCar * carCount;

  if (nearbyZones.length === 0) {
    return {
      transfers: [],
      total_absorption_pct: 0,
      churn_pct: 1,
      cost_saved_monthly: costSavedMonthly,
      churn_loss_monthly: targetMonthlyRevenue,
      net_effect_monthly: costSavedMonthly - targetMonthlyRevenue,
    };
  }

  // Inverse-distance weighting x capacity factor
  const weights: number[] = nearbyZones.map((z) => {
    const dist = Math.max(z.distance_m || 1, 1); // avoid division by zero
    const capacityFactor = Math.max(1 - (z.utilization || 0), 0);
    return (1 / dist) * capacityFactor;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const rawAbsorptions = weights.map((w) =>
    totalWeight > 0 ? w / totalWeight : 0,
  );

  // Scale total absorption by target utilization (proxy for transferable demand)
  const maxAbsorption = Math.min(utilization, 1);

  let totalAbsorptionPct = 0;
  const transfers: TransferItem[] = [];

  for (let i = 0; i < nearbyZones.length; i++) {
    const absorptionPct = rawAbsorptions[i] * maxAbsorption;
    totalAbsorptionPct += absorptionPct;
    transfers.push({
      zone_id: nearbyZones[i].id,
      zone_name: nearbyZones[i].name,
      absorption_pct: Math.round(absorptionPct * 10000) / 10000,
    });
  }

  totalAbsorptionPct = Math.round(Math.min(totalAbsorptionPct, 1) * 10000) / 10000;
  const churnPct = Math.round(Math.max(1 - totalAbsorptionPct, 0) * 10000) / 10000;

  const churnLossMonthly = churnPct * targetMonthlyRevenue;
  const netEffectMonthly = costSavedMonthly - churnLossMonthly;

  return {
    transfers,
    total_absorption_pct: totalAbsorptionPct,
    churn_pct: churnPct,
    cost_saved_monthly: costSavedMonthly,
    churn_loss_monthly: Math.round(churnLossMonthly * 100) / 100,
    net_effect_monthly: Math.round(netEffectMonthly * 100) / 100,
  };
}
