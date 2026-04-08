-- 클러스터 유형의 전국 평균 실적
-- 파라미터:
--   {cluster_type} : 클러스터명 (문자열, 따옴표 포함해서 치환)
--
-- 반환: avg_revenue_per_car, avg_utilization, zone_count
WITH date_range AS (
  SELECT
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 90 DAY) AS start_date,
    DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY) AS end_date
)
SELECT
  AVG(perf.revenue_per_car) AS avg_revenue_per_car,
  AVG(perf.utilization) AS avg_utilization,
  COUNT(*) AS zone_count
FROM (
  SELECT
    p.zone_id,
    SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS revenue_per_car,
    SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS utilization
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  LEFT JOIN `socar-data.socar_biz.operation_per_car_daily_v2` o
    ON p.date = o.date AND p.car_id = o.car_id
  JOIN `socar-data.dst_analytics.zone_commercial_clusters` c
    ON p.zone_id = c.zone_id
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.start_date AND d.end_date
    AND c.cluster_name = {cluster_type}
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
  GROUP BY p.zone_id
) perf
