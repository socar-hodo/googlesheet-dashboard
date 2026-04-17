-- 주별 고객 유형(way)별 이용건수
-- params: {start_date} (DATE string), {end_date} (DATE string)
-- week format: "N월 N주차" (프론트엔드 호환)

WITH raw AS (
  SELECT
    r.date AS d,
    r.way
  FROM `socar-data.soda_store.reservation_v2` r
  WHERE r.date BETWEEN '{start_date}' AND '{end_date}'
    AND r.state IN (3, 5)
    AND r.member_imaginary IN (0, 9)
    AND r.sharing_type IN ('socar', 'zplus')
    AND r.region1 IN ('경상남도', '울산광역시')
)

SELECT
  CONCAT(
    CAST(EXTRACT(MONTH FROM DATE_TRUNC(d, ISOWEEK)) AS STRING),
    '월 ',
    CAST(DIV(EXTRACT(DAY FROM DATE_TRUNC(d, ISOWEEK)) - 1, 7) + 1 AS STRING),
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
