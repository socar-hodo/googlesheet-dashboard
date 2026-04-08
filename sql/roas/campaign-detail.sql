-- campaign-detail.sql: 캠페인 상세 (4개 섹션)
-- 파라미터: {policy_id}

-- @section meta
-- 쿠폰 정책 기본정보 + 타겟존/지역
SELECT id, name, division, discount_price, discount_percent,
  include_zone, include_region1, include_region2,
  usable_start_on, usable_end_on
FROM `socar-data.tianjin_replica.coupon_policy`
WHERE id = {policy_id}

-- @section summary
-- 쿠폰 발급/사용 요약
SELECT
  COUNT(DISTINCT ci.id) AS issued,
  COUNT(DISTINCT CASE WHEN ci.reservation_id IS NOT NULL THEN ci.id END) AS used,
  COALESCE(SUM(r.revenue), 0) AS revenue,
  COALESCE(SUM(ABS(r.__rev_coupon)), 0) AS discount
FROM `socar-data.tianjin_replica.coupon_info` ci
LEFT JOIN `socar-data.soda_store.reservation_v2` r
  ON ci.reservation_id = r.reservation_id AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
WHERE ci.policy_id = {policy_id}

-- @section crosstab
-- 쿠폰 사용 예약의 연령대 x 이용시간 크로스탭
SELECT
  r.age_group,
  CASE
    WHEN r.utime < 4 THEN '01_under_4h'
    WHEN r.utime < 24 THEN '02_4h_24h'
    WHEN r.utime < 36 THEN '03_24h_36h'
    WHEN r.utime < 48 THEN '04_36h_48h'
    ELSE '05_48h_plus'
  END AS duration_group,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue,
  SAFE_DIVIDE(SUM(r.revenue), COUNT(*)) AS rev_per_use
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.coupon_policy_id = {policy_id}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY r.age_group, duration_group
ORDER BY r.age_group, duration_group

-- @section daily_trend
-- 일별 추이
SELECT DATE(r.date) AS date,
  COUNT(*) AS used_count,
  SUM(r.revenue) AS revenue,
  SUM(ABS(r.__rev_coupon)) AS discount
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.coupon_policy_id = {policy_id}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY date
ORDER BY date
