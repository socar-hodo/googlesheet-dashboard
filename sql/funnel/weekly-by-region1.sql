-- 전국 시/도별 주간 존클릭→예약 전환율
-- params: {weeks} (정수, 조회 주차 수)

WITH zone_master AS (
  SELECT
    id AS zone_id,
    region1
  FROM `socar-data.tianjin_replica.carzone_info`
  WHERE imaginary = 0
),

click_base AS (
  SELECT
    DATE_TRUNC(DATE(g.event_timestamp, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    EXTRACT(ISOYEAR FROM DATE(g.event_timestamp, 'Asia/Seoul')) AS iso_year,
    EXTRACT(ISOWEEK FROM DATE(g.event_timestamp, 'Asia/Seoul')) AS iso_week_num,
    TIMESTAMP(g.event_timestamp) AS click_ts,
    g.member_id,
    z.region1,
    g.zone_id
  FROM `socar-data.socar_server_2.get_car_classes` g
  INNER JOIN zone_master z ON g.zone_id = z.zone_id
  WHERE DATE(g.event_timestamp, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND g.member_id IS NOT NULL
),

reservation_base AS (
  SELECT
    DATE_TRUNC(DATE(r.created_at, 'Asia/Seoul'), ISOWEEK) AS iso_week_start,
    TIMESTAMP(r.created_at) AS res_ts,
    r.member_id,
    z.region1,
    r.zone_id
  FROM `socar-data.tianjin_replica.reservation_info` r
  INNER JOIN zone_master z ON r.zone_id = z.zone_id
  WHERE DATE(r.created_at, 'Asia/Seoul')
        >= DATE_SUB(
             DATE_TRUNC(CURRENT_DATE('Asia/Seoul'), ISOWEEK),
             INTERVAL ({weeks} + 1) WEEK
           )
    AND r.member_id IS NOT NULL
    AND r.channel NOT IN (
      'admin', 'system', 'alliance/naver_place', 'alliance/web_partners',
      'test_drive/owned', 'mobile/web', 'mobile/ios/web/korailtalk',
      'mobile/android/web/korailtalk', 'alliance/ota', 'test_drive'
    )
),

click_member_week AS (
  SELECT
    iso_week_start,
    region1,
    member_id,
    MIN(click_ts) AS first_click_ts,
    COUNT(*) AS zone_click_cnt
  FROM click_base
  GROUP BY 1, 2, 3
),

converted_member_week AS (
  SELECT DISTINCT
    c.iso_week_start,
    c.region1,
    c.member_id
  FROM click_member_week c
  INNER JOIN reservation_base r
    ON c.member_id = r.member_id
   AND c.iso_week_start = r.iso_week_start
   AND c.region1 = r.region1
   AND r.res_ts >= c.first_click_ts
),

weekly_summary AS (
  SELECT
    c.iso_week_start,
    c.region1,
    SUM(c.zone_click_cnt) AS zone_click_cnt,
    COUNT(DISTINCT c.member_id) AS click_member_cnt,
    COUNT(DISTINCT v.member_id) AS converted_member_cnt
  FROM click_member_week c
  LEFT JOIN converted_member_week v
    ON c.iso_week_start = v.iso_week_start
   AND c.region1 = v.region1
   AND c.member_id = v.member_id
  GROUP BY 1, 2
)

SELECT
  CONCAT(
    CAST(EXTRACT(ISOYEAR FROM iso_week_start) AS STRING),
    '-W',
    FORMAT('%02d', EXTRACT(ISOWEEK FROM iso_week_start))
  ) AS year_week,
  iso_week_start,
  region1,
  zone_click_cnt,
  click_member_cnt,
  converted_member_cnt,
  SAFE_DIVIDE(converted_member_cnt, click_member_cnt) AS cvr,
  LAG(SAFE_DIVIDE(converted_member_cnt, click_member_cnt))
    OVER (PARTITION BY region1 ORDER BY iso_week_start) AS prev_cvr
FROM weekly_summary
ORDER BY iso_week_start, region1
