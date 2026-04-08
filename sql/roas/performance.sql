-- performance.sql: 연령대 x 이용시간 크로스탭 실적
-- 파라미터: {zone_ids}, {start_date}, {end_date}
SELECT
  age_group,
  CASE
    WHEN utime < 4 THEN '01_under_4h'
    WHEN utime < 24 THEN '02_4h_24h'
    WHEN utime < 36 THEN '03_24h_36h'
    WHEN utime < 48 THEN '04_36h_48h'
    ELSE '05_48h_plus'
  END AS duration_group,
  CASE
    WHEN EXTRACT(DAYOFWEEK FROM date) IN (1, 7) THEN 'weekend'
    ELSE 'weekday'
  END AS day_type,
  COUNT(*) AS nuse,
  SUM(revenue) + SUM(ABS(__rev_coupon)) AS revenue,
  SAFE_DIVIDE(SUM(revenue) + SUM(ABS(__rev_coupon)), COUNT(*)) AS rev_per_use
FROM `socar-data.soda_store.reservation_v2`
WHERE date BETWEEN {start_date} AND {end_date}
  AND zone_id IN ({zone_ids})
  AND state IN (3, 5)
  AND member_imaginary IN (0, 9)
  AND sharing_type IN ('socar', 'zplus')
GROUP BY age_group, duration_group, day_type
ORDER BY age_group, duration_group, day_type
