-- 일별 고객 유형(way)별 이용건수
-- params: {start_date} (DATE string), {end_date} (DATE string)
-- way mapping: general → 왕복, d2d_round → 배달, d2d_oneway → 편도

SELECT
  FORMAT_DATE('%Y-%m-%d', r.date) AS d,
  COUNTIF(r.way = 'general') AS round_trip_count,
  COUNTIF(r.way = 'd2d_round') AS call_count,
  COUNTIF(r.way = 'd2d_oneway') AS one_way_count
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN '{start_date}' AND '{end_date}'
  AND r.state IN (3, 5)
  AND r.member_imaginary IN (0, 9)
  AND r.sharing_type IN ('socar', 'zplus')
GROUP BY d
ORDER BY d
