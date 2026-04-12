-- 지역 내 전체 존 실적 + 위경도 (최적화 모드용)
-- 파라미터:
--   where_clause : 동적 WHERE 조건 (lib/zone.ts에서 조립)
--
-- 반환: zone_id, zone_name, lat, lng, region1, region2, car_count,
--        revenue_per_car, utilization, total_nuse
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  z.id AS zone_id,
  z.name AS zone_name,
  z.lat, z.lng,
  z.region1, z.region2,
  COUNT(DISTINCT p.car_id) AS car_count,
  SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
  SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization,
  SUM(p.nuse) AS total_nuse
FROM `socar-data.socar_biz_base.carzone_info_daily` z
CROSS JOIN date_range d
LEFT JOIN `socar-data.socar_biz_profit.profit_socar_car_daily` p
  ON z.id = p.zone_id
  AND p.date BETWEEN d.start_date AND d.end_date
  AND p.car_sharing_type IN ('socar', 'zplus')
  AND p.car_state IN ('운영', '수리')
LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
  ON p.date = o.date AND p.car_id = o.car_id
WHERE z.date = DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY)
  AND z.state = 1
  AND z.lat IS NOT NULL AND z.lng IS NOT NULL
  {where_clause}
GROUP BY z.id, z.name, z.lat, z.lng, z.region1, z.region2
ORDER BY utilization DESC
