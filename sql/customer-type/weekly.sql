-- 주별 고객 유형(way)별 이용건수
-- params: @start_date (DATE), @end_date (DATE), @region1 (STRING), @zone_ids (ARRAY<INT64>)
-- week format: "N월 N주차" (프론트엔드 호환)

WITH raw AS (
  SELECT
    DATE(r.rent_start_at, 'Asia/Seoul') AS d,
    r.way
  FROM `socar-data.soda_store.reservation_v2` r
  WHERE DATE(r.rent_start_at, 'Asia/Seoul') BETWEEN @start_date AND @end_date
    AND r.state IN (3, 5)
    AND r.member_imaginary IN (0, 9)
    AND (@region1 = '' OR r.zone_id IN (
      SELECT id FROM `socar-data.socar_biz_base.carzone_info_daily` z
      WHERE z.date = DATE(r.rent_start_at, 'Asia/Seoul')
        AND z.region1 = @region1
    ))
    AND (ARRAY_LENGTH(@zone_ids) = 0 OR r.zone_id IN UNNEST(@zone_ids))
)

SELECT
  CONCAT(
    CAST(EXTRACT(MONTH FROM DATE_TRUNC(d, ISOWEEK)) AS STRING),
    '월 ',
    CAST(
      DIV(EXTRACT(DAY FROM DATE_TRUNC(d, ISOWEEK)) - 1, 7) + 1
    AS STRING),
    '주차'
  ) AS week_label,
  EXTRACT(ISOYEAR FROM d) AS iso_year,
  EXTRACT(ISOWEEK FROM d) AS iso_week,
  COUNTIF(way = 'general') AS round_trip_count,
  COUNTIF(way = 'd2d_round') AS call_count,
  COUNTIF(way = 'd2d_oneway') AS one_way_count
FROM raw
GROUP BY iso_year, iso_week, week_label
ORDER BY iso_year, iso_week
