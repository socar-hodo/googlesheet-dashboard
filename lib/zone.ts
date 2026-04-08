/**
 * Zone 시뮬레이터 — BQ 쿼리 모듈
 * Ported from: zone-simulator/bq.py
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { runQuery } from "@/lib/bigquery";
import type {
  ZoneInfo,
  ZonePerformance,
  ClusterBenchmark,
  RegionZoneStat,
} from "@/types/zone";

// ── SQL 파일 경로 ──────────────────────────────────────────────
const SQL_DIR = resolve(process.cwd(), "sql/zone");

function loadSql(filename: string): string {
  return readFileSync(resolve(SQL_DIR, filename), "utf-8");
}

// ── SQL injection 방지 ─────────────────────────────────────────
const SQL_UNSAFE = /['";\\]/;

function assertSafe(value: string, label: string): void {
  if (SQL_UNSAFE.test(value)) {
    throw new Error(`${label}에 허용되지 않는 문자가 포함되어 있습니다.`);
  }
}

// ── 존 캐시 (1시간 TTL, 모듈 레벨 Map) ───────────────────────
let _zoneCache: ZoneInfo[] | null = null;
let _zoneCacheTs = 0;
const CACHE_TTL = 3600 * 1000; // 1시간 (ms)

function num(v: unknown): number {
  return Number(v) || 0;
}

// ── 지역 목록 ─────────────────────────────────────────────────

/** region1 목록 조회 (인라인 SQL — 단순 SELECT DISTINCT). */
export async function getRegions(): Promise<string[]> {
  const sql = `
    SELECT DISTINCT region1
    FROM \`socar-data.socar_biz_base.carzone_info_daily\`
    WHERE date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
      AND region1 IS NOT NULL
    ORDER BY region1
  `;
  const rows = await runQuery(sql);
  if (!rows) return [];
  return rows.map((r) => String(r.region1));
}

/** region2 목록 조회. */
export async function getSubRegions(region1: string): Promise<string[]> {
  assertSafe(region1, "region1");
  const sql = `
    SELECT DISTINCT region2
    FROM \`socar-data.socar_biz_base.carzone_info_daily\`
    WHERE date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
      AND region1 = '${region1}'
      AND region2 IS NOT NULL
    ORDER BY region2
  `;
  const rows = await runQuery(sql);
  if (!rows) return [];
  return rows.map((r) => String(r.region2));
}

// ── 존 목록 (위경도 포함) ────────────────────────────────────

/** 존 목록 조회. 필터 없으면 캐시 사용 (1시간 TTL). */
export async function getZones(
  region1?: string,
  region2?: string,
): Promise<ZoneInfo[]> {
  // 필터 없는 전체 조회는 캐시 사용
  if (!region1 && !region2) {
    if (_zoneCache && Date.now() - _zoneCacheTs < CACHE_TTL) {
      return _zoneCache;
    }
  }

  let whereClause = "";
  if (region1) {
    assertSafe(region1, "region1");
    whereClause += `AND z.region1 = '${region1}'`;
  }
  if (region2) {
    assertSafe(region2, "region2");
    whereClause += ` AND z.region2 = '${region2}'`;
  }

  const raw = loadSql("zones.sql");
  const sql = raw.replace("{where_clause}", whereClause);

  const rows = await runQuery(sql);
  if (!rows) return [];

  const result: ZoneInfo[] = rows.map((r) => ({
    id: num(r.zone_id),
    name: String(r.zone_name ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
    region1: String(r.region1 ?? ""),
    region2: String(r.region2 ?? ""),
    car_count: num(r.car_count),
  }));

  // 전체 조회 결과 캐시
  if (!region1 && !region2) {
    _zoneCache = result;
    _zoneCacheTs = Date.now();
  }

  return result;
}

// ── 존 실적 (최근 90일) ─────────────────────────────────────

/** 존별 최근 90일 평균 실적 조회. */
export async function getZonePerformance(
  zoneIds: number[],
): Promise<ZonePerformance[]> {
  if (zoneIds.length === 0) return [];

  const raw = loadSql("zone-performance.sql");
  const sql = raw.replace("{zone_ids}", zoneIds.join(", "));

  const rows = await runQuery(sql);
  if (!rows) return [];

  return rows.map((r) => ({
    zone_id: num(r.zone_id),
    revenue_per_car: num(r.revenue_per_car),
    utilization: num(r.utilization),
    total_nuse: num(r.total_nuse),
    car_count: num(r.car_count),
    avg_daily_cost_fixed: num(r.avg_daily_cost_fixed),
  }));
}

// ── 클러스터 벤치마크 ───────────────────────────────────────

/** 해당 클러스터 유형의 전국 평균 실적. */
export async function getClusterBenchmark(
  clusterType: string,
): Promise<ClusterBenchmark> {
  assertSafe(clusterType, "cluster_type");
  const raw = loadSql("cluster-benchmark.sql");
  const sql = raw.replace("{cluster_type}", `'${clusterType}'`);

  const rows = await runQuery(sql);
  if (!rows || rows.length === 0) {
    return { avg_revenue_per_car: 0, avg_utilization: 0, zone_count: 0 };
  }

  const r = rows[0];
  return {
    avg_revenue_per_car: num(r.avg_revenue_per_car),
    avg_utilization: num(r.avg_utilization),
    zone_count: num(r.zone_count),
  };
}

/** 존의 상업 클러스터 유형 조회. */
export async function getZoneClusterType(
  zoneId: number,
): Promise<string | null> {
  const raw = loadSql("zone-cluster.sql");
  const sql = raw.replace("{zone_id}", String(zoneId));

  const rows = await runQuery(sql);
  if (!rows || rows.length === 0) return null;
  return String(rows[0].cluster_name);
}

// ── 지역 최적화 ─────────────────────────────────────────────

/** 지역 내 전체 존의 실적 + 위경도. 최적화 모드용. */
export async function getRegionZoneStats(
  region1: string,
  region2?: string,
): Promise<RegionZoneStat[]> {
  assertSafe(region1, "region1");
  let whereClause = `AND z.region1 = '${region1}'`;
  if (region2) {
    assertSafe(region2, "region2");
    whereClause += ` AND z.region2 = '${region2}'`;
  }

  const raw = loadSql("region-zone-stats.sql");
  const sql = raw.replace("{where_clause}", whereClause);

  const rows = await runQuery(sql);
  if (!rows) return [];

  return rows.map((r) => ({
    zone_id: num(r.zone_id),
    zone_name: String(r.zone_name ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
    region1: String(r.region1 ?? ""),
    region2: String(r.region2 ?? ""),
    car_count: num(r.car_count),
    revenue_per_car: num(r.revenue_per_car),
    utilization: num(r.utilization),
    total_nuse: num(r.total_nuse),
  }));
}
