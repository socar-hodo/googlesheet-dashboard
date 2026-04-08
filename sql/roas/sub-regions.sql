-- sub-regions.sql: region2 목록 조회
-- 파라미터: {region1} (쿼테이션 포함 문자열, 예: '경상남도')
SELECT DISTINCT region2
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 = {region1}
  AND region2 IS NOT NULL
  AND region2 != ''
ORDER BY region2
