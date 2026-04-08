-- campaigns.sql: 캠페인 목록 조회
-- 파라미터: {start_date}, {end_date}
WITH policy_stats AS (
  SELECT policy_id,
    COUNT(DISTINCT id) AS issued_count,
    COUNT(DISTINCT CASE WHEN reservation_id IS NOT NULL THEN id END) AS used_count,
    MIN(DATE(created_at, "Asia/Seoul")) AS first_issued,
    MAX(DATE(used_at, "Asia/Seoul")) AS last_used
  FROM `socar-data.tianjin_replica.coupon_info`
  GROUP BY policy_id
),
revenue_stats AS (
  SELECT coupon_policy_id AS policy_id,
    SUM(revenue) AS post_discount_revenue,
    SUM(ABS(__rev_coupon)) AS total_discount,
    SUM(revenue) + SUM(ABS(__rev_coupon)) AS total_revenue
  FROM `socar-data.soda_store.reservation_v2`
  WHERE state IN (3, 5) AND member_imaginary IN (0, 9)
    AND sharing_type IN ('socar', 'zplus')
    AND date >= DATE_SUB({start_date}, INTERVAL 6 MONTH)
  GROUP BY coupon_policy_id
)
SELECT cp.id AS policy_id, cp.name, cp.division,
  cp.discount_price, cp.discount_percent,
  cp.usable_start_on, cp.usable_end_on,
  ps.issued_count, ps.used_count,
  SAFE_DIVIDE(ps.used_count, ps.issued_count) * 100 AS usage_rate,
  rs.total_revenue, rs.total_discount,
  rs.post_discount_revenue AS net_revenue,
  SAFE_DIVIDE(rs.total_revenue, rs.total_discount) * 100 AS roas,
  ps.first_issued, ps.last_used
FROM `socar-data.tianjin_replica.coupon_policy` cp
LEFT JOIN policy_stats ps ON ps.policy_id = cp.id
LEFT JOIN revenue_stats rs ON rs.policy_id = cp.id
WHERE (
  DATE(cp.usable_start_on, "Asia/Seoul") BETWEEN {start_date} AND {end_date}
  OR (cp.usable_start_on IS NULL AND DATE(cp.created_at, "Asia/Seoul") BETWEEN {start_date} AND {end_date})
)
ORDER BY ps.used_count DESC
