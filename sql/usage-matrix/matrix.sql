-- 연령대 × 이용시간 × 날짜 × 요일유형 크로스탭 — 건수 + 매출
-- params: {start_date}, {end_date}, {region_filter}
-- duration 구간: 기존 usage-duration 버킷과 동일 (6 buckets: ~4h / 4h+ / 8h+ / 12h+ / 1d+ / 2d+)
-- date 차원을 포함하여 클라이언트에서 기간 재필터 가능.
-- 현재 기간 + 직전 동일 길이 비교 기간 모두 이 쿼리 한 번으로 커버 (data.ts가 넓은 range로 조회).
-- 매출은 예약 매출(revenue) + 쿠폰 차감분(__rev_coupon) — ROAS 성능 매트릭스와 동일 기준.

SELECT
  FORMAT_DATE('%Y-%m-%d', date) AS d,
  age_group,
  CASE
    WHEN utime <  4                      THEN 'under4h'
    WHEN utime >= 4  AND utime <  8      THEN 'from4to8h'
    WHEN utime >= 8  AND utime < 12      THEN 'from8to12h'
    WHEN utime >= 12 AND utime < 24      THEN 'from12to24h'
    WHEN utime >= 24 AND utime < 48      THEN 'from24to48h'
    ELSE 'over48h'
  END AS duration_group,
  CASE
    WHEN EXTRACT(DAYOFWEEK FROM date) IN (1, 7) THEN 'weekend'
    ELSE 'weekday'
  END AS day_type,
  COUNT(*) AS nuse,
  SUM(revenue) + SUM(ABS(__rev_coupon)) AS revenue
FROM `socar-data.soda_store.reservation_v2`
WHERE date BETWEEN '{start_date}' AND '{end_date}'
  AND state IN (3, 5)
  AND member_imaginary IN (0, 9)
  AND sharing_type IN ('socar', 'zplus')
  AND utime IS NOT NULL AND utime >= 0
  AND age_group IS NOT NULL
  {region_filter}
GROUP BY d, age_group, duration_group, day_type
ORDER BY d, age_group, duration_group, day_type
