-- 일별 고객 유형(way)별 이용건수
-- params: @start_date (DATE), @end_date (DATE), @region1 (STRING), @zone_ids (ARRAY<INT64>)
-- way mapping: general → 왕복, d2d_round → 배달, d2d_oneway → 편도

SELECT
  FORMAT_DATE('%Y-%m-%d', r.date) AS d,
  COUNTIF(r.way = 'general') AS round_trip_count,
  COUNTIF(r.way = 'd2d_round') AS call_count,
  COUNTIF(r.way = 'd2d_oneway') AS one_way_count
FROM `socar-data.soda_store.reservation_v2` r
WHERE r.date BETWEEN @start_date AND @end_date
  AND r.state IN (3, 5)
  AND r.member_imaginary IN (0, 9)
  AND (@region1 = '' OR r.zone_id IN (
    SELECT id FROM `socar-data.socar_biz_base.carzone_info_daily` z
    WHERE z.date = r.date
      AND z.region1 = @region1
  ))
  AND (ARRAY_LENGTH(@zone_ids) = 0 OR r.zone_id IN UNNEST(@zone_ids))
GROUP BY d
ORDER BY d
