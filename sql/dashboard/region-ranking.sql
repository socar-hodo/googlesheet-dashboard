-- 지역별 매출·손익·이용건수·가동률 랭킹
-- params: {start_date}, {end_date}, {group_field} (region1 또는 region2), {parent_filter}
-- parent_filter 예시:
--   전국 랭킹(region1):           ''
--   region1 drill → region2 랭킹: "AND region1 = '서울특별시'"

WITH profit AS (
  SELECT
    {group_field} AS region,
    SUM(revenue) AS revenue,
    SUM(profit) AS profit,
    SUM(nuse) AS usage_count,
    SUM(utime) AS usage_hours
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND car_sharing_type IN ('socar', 'zplus')
    AND car_state IN ('운영', '수리')
    {parent_filter}
  GROUP BY region
),

operation AS (
  SELECT
    {group_field} AS region,
    SUM(op_min) AS op_min,
    SUM(dp_min) AS dp_min
  FROM `socar-data.socar_biz.operation_per_car_daily_v2`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND sharing_type IN ('socar', 'zplus')
    {parent_filter}
  GROUP BY region
)

SELECT
  p.region,
  p.revenue,
  p.profit,
  SAFE_DIVIDE(p.profit, p.revenue) AS gpm,
  p.usage_count,
  p.usage_hours,
  SAFE_DIVIDE(o.op_min, o.dp_min) * 100 AS utilization_rate
FROM profit p
LEFT JOIN operation o USING (region)
WHERE p.region IS NOT NULL AND p.region != ''
ORDER BY p.revenue DESC
