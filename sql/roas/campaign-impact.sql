-- campaign-impact.sql: 영향도 분석 (9개 섹션)
-- 각 섹션은 API route에서 필요한 파라미터를 치환 후 개별 실행

-- @section meta
-- 캠페인 메타 정보 (기간, 타겟존, 지역)
-- 파라미터: {policy_id}
SELECT usable_start_on, usable_end_on, include_zone,
  include_region1, include_region2
FROM `socar-data.tianjin_replica.coupon_policy`
WHERE id = {policy_id}

-- @section analysis_a_with_zones
-- Analysis A: 쿠폰 사용 vs 미사용 (타겟존 필터)
-- 파라미터: {policy_id}, {target_zones}, {camp_start}, {camp_end}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({target_zones})
GROUP BY group_type

-- @section analysis_a_with_region
-- Analysis A: 쿠폰 사용 vs 미사용 (지역 필터)
-- 파라미터: {policy_id}, {camp_start}, {camp_end}, {region1}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN (SELECT id FROM `socar-data.socar_biz_base.carzone_info_daily` WHERE date = {camp_start} AND region1 = {region1})
GROUP BY group_type

-- @section analysis_a_no_filter
-- Analysis A: 쿠폰 사용 vs 미사용 (필터 없음)
-- 파라미터: {policy_id}, {camp_start}, {camp_end}
SELECT
  CASE WHEN r.coupon_policy_id = {policy_id} THEN 'coupon' ELSE 'non_coupon' END AS group_type,
  COUNT(*) AS cnt,
  AVG(r.revenue) AS avg_revenue,
  AVG(r.utime) AS avg_utime
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN {camp_start} AND {camp_end}
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY group_type

-- @section zone_fetch_by_region
-- region1 기반 존 ID 목록 조회 (Analysis B 존 목록 fallback용)
-- 파라미터: {region1}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}

-- @section analysis_b
-- Analysis B: 전후 비교
-- 파라미터: {before_start}, {before_end}, {camp_start}, {camp_end}, {b_zones}
SELECT
  CASE WHEN r.date BETWEEN {before_start} AND {before_end} THEN 'before' ELSE 'after' END AS period,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end} OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({b_zones})
GROUP BY period

-- @section control_zones_with_region
-- 비타겟존 조회 (region1 + target_zones 제외)
-- 파라미터: {region1}, {target_zones}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}
  AND id NOT IN ({target_zones})

-- @section control_zones_infer_region
-- target_zones에서 region1 추출
-- 파라미터: {target_zones}
SELECT DISTINCT region1
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND id IN ({target_zones})

-- @section control_zones_from_regions
-- 추출된 region 목록으로 비타겟존 조회
-- 파라미터: {regions}, {target_zones}
SELECT DISTINCT id
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 IN ({regions})
  AND id NOT IN ({target_zones})

-- @section did
-- DID 분석: 타겟존 vs 비타겟존, 전후 비교
-- 파라미터: {target_zones}, {before_start}, {before_end}, {camp_start}, {camp_end}, {all_zones}
SELECT
  CASE WHEN r.zone_id IN ({target_zones}) THEN 'target' ELSE 'control' END AS group_type,
  CASE WHEN r.date BETWEEN {before_start} AND {before_end} THEN 'before' ELSE 'after' END AS period,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end} OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({all_zones})
GROUP BY group_type, period

-- @section did_daily
-- DID 일별 시계열
-- 파라미터: {target_zones}, {before_start}, {before_end}, {camp_start}, {camp_end}, {all_zones}
SELECT
  r.date,
  CASE WHEN r.zone_id IN ({target_zones}) THEN 'target' ELSE 'control' END AS group_type,
  COUNT(*) AS nuse,
  SUM(r.revenue) AS revenue
FROM `socar-data.soda_store.reservation_v2` r
WHERE (r.date BETWEEN {before_start} AND {before_end}
    OR r.date BETWEEN {camp_start} AND {camp_end})
  AND r.state IN (3, 5) AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
  AND r.zone_id IN ({all_zones})
GROUP BY r.date, group_type
ORDER BY r.date

-- @section verdict_summary
-- Verdict용 쿠폰 발급/사용 수 집계
-- 파라미터: {policy_id}
SELECT
  COUNT(DISTINCT id) AS issued,
  COUNT(DISTINCT CASE WHEN reservation_id IS NOT NULL THEN id END) AS used
FROM `socar-data.tianjin_replica.coupon_info`
WHERE policy_id = {policy_id}

-- @section verdict_revenue
-- Verdict용 매출/할인 집계
-- 파라미터: {policy_id}
SELECT SUM(revenue) AS post_discount_revenue, SUM(ABS(__rev_coupon)) AS total_discount
FROM `socar-data.soda_store.reservation_v2`
WHERE coupon_policy_id = {policy_id} AND state IN (3, 5) AND member_imaginary IN (0, 9)
  AND sharing_type IN ('socar', 'zplus')
