-- zones.sql: 카셰어링 차량이 배치된 운영 존 목록
-- 파라미터: {region1} (쿼테이션 포함 문자열), {region2_list} (쿼테이션 포함 문자열 목록)
SELECT DISTINCT z.id, z.name, z.address
FROM `socar-data.socar_biz_base.carzone_info_daily` z
WHERE z.date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND z.region1 = {region1}
  AND z.region2 IN ({region2_list})
  AND z.state = 1
  AND EXISTS (
    SELECT 1 FROM `socar-data.socar_biz_base.car_info_daily` c
    WHERE c.date = z.date AND c.zone_id = z.id
      AND c.sharing_type IN ('socar', 'zplus')
  )
ORDER BY z.name
