-- regions.sql: region1 목록 조회 (화이트리스트 필터링)
SELECT DISTINCT region1
FROM `socar-data.socar_biz_base.carzone_info_daily`
WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
  AND region1 IS NOT NULL
  AND region1 != ''
  AND region1 != '-'
  AND region1 NOT LIKE '%테스트%'
  AND region1 IN (
    '서울특별시','부산광역시','대구광역시','인천광역시','광주광역시',
    '대전광역시','울산광역시','세종특별자치시','경기도','강원도',
    '충청북도','충청남도','전라북도','전라남도','경상북도','경상남도',
    '제주특별자치도'
  )
ORDER BY region1
