-- 존별 최근 90일 평균 실적
-- 파라미터:
--   {zone_ids} : 존 ID 목록 (예: 1, 2, 3)
--
-- 반환: zone_id, revenue_per_car, utilization, total_nuse, car_count, avg_daily_cost_fixed
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  p.zone_id,
  SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
  SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization,
  SUM(p.nuse) AS total_nuse,
  COUNT(DISTINCT p.car_id) AS car_count,
  SAFE_DIVIDE(SUM(p.cost_fixed), COUNT(DISTINCT p.date)) AS avg_daily_cost_fixed
FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
  ON p.date = o.date AND p.car_id = o.car_id
CROSS JOIN date_range d
WHERE p.date BETWEEN d.start_date AND d.end_date
  AND p.zone_id IN ({zone_ids})
  AND p.car_sharing_type IN ('socar', 'zplus')
  AND p.car_state IN ('운영', '수리')
GROUP BY p.zone_id
