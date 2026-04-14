SELECT DISTINCT region1
FROM `socar-data.tianjin_replica.carzone_info`
WHERE imaginary = 0
  AND region1 IS NOT NULL
ORDER BY region1
