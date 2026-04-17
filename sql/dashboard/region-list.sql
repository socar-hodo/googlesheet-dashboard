-- 드롭다운용 지역1·지역2 리스트
-- 최근 30일간 이용이 있었던 지역만 반환 (데드존 제외)

SELECT
  region1,
  region2
FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
WHERE date BETWEEN DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 30 DAY) AND CURRENT_DATE('Asia/Seoul')
  AND car_sharing_type IN ('socar', 'zplus')
  AND car_state IN ('운영', '수리')
  AND region1 IS NOT NULL
  AND region1 != ''
GROUP BY region1, region2
HAVING SUM(revenue) > 0
ORDER BY region1, region2
