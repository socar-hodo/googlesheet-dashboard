-- 존의 상업 클러스터 유형 조회
-- 파라미터:
--   {zone_id} : 존 ID (정수)
--
-- 반환: cluster_name
SELECT cluster_name
FROM `socar-data.dst_analytics.zone_commercial_clusters`
WHERE zone_id = {zone_id}
LIMIT 1
