-- ============================================================
-- 재배치 후보 차량 조회
-- 파라미터: {region2_in} — 'A존', 'B존', ... 형태의 IN 절 값
-- ============================================================
SELECT
  c.id       AS car_id,
  c.car_name,
  c.car_num,
  z.region1,
  z.region2
FROM `socar-data.socar_biz_base.car_info_daily` c
JOIN `socar-data.socar_biz_base.carzone_info_daily` z
  ON c.zone_id = z.id
 AND c.date    = z.date
WHERE c.date = CURRENT_DATE("Asia/Seoul")
  AND c.sharing_type IN ('socar', 'zplus')
  AND c.imaginary = 0
  AND z.region2 IN ({region2_in})
ORDER BY z.region1, z.region2, c.car_name
