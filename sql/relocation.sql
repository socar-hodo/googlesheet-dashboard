-- ============================================================
-- 차량 재배치 의사결정 도구 쿼리
-- 파라미터 (Python에서 .format()으로 치환):
--   {region1_filter}   : 광역 필터 ("전체" | "서울특별시" 등)
--   {past_days}        : 과거 기간 일수 (7, 14, 30)
--   {future_days}      : 미래 기간 일수 (3, 7, 14)
--
-- 치환 규칙:
--   {region1_filter} = "전체" 이면 {region1_where} = "", {region1_where_z} = ""
--   {region1_filter} != "전체" 이면:
--     {region1_where} = "AND region1 = '{region1_filter}'"
--     {region1_where_z} = "AND z.region1 = '{region1_filter}'"
--
-- 테이블 구조 참고:
--   carzone_info_daily.id = zone_id (zone_id 컬럼명 아님)
--   reservation_info.state: 0=예약, 1=예약확정, 2=이용중, 3=이용완료 (3,5는 완료)
--   operation_per_car_hourly_v2: region1, region2, datetime 기준
-- ============================================================

WITH past_operation AS (
  SELECT
    region1,
    region2,
    SAFE_DIVIDE(SUM(op_min), SUM(dp_min)) AS util_rate,
    COUNT(DISTINCT car_id)                 AS car_count
  FROM `socar-data.socar_biz.operation_per_car_daily_v2`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL {past_days} DAY)
                 AND DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
    AND sharing_type IN ('socar', 'zplus')
    {region1_where}
  GROUP BY region1, region2
),

past_revenue AS (
  SELECT
    region1,
    region2,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT car_id)) AS rev_per_car
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL {past_days} DAY)
                 AND DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
    AND car_sharing_type IN ('socar', 'zplus')
    {region1_where}
  GROUP BY region1, region2
),

reserved_base AS (
  -- carzone_info_daily의 zone 식별 컬럼은 `id` (zone_id 아님)
  -- region1 필터는 JOIN 후 z.region1 기준으로 적용
  SELECT
    r.car_id,
    r.start_at,
    r.end_at,
    z.region1,
    z.region2
  FROM `socar-data.tianjin_replica.reservation_info` r
  JOIN `socar-data.socar_biz_base.carzone_info_daily` z
    ON r.zone_id = z.id
   AND DATE(r.start_at, "Asia/Seoul") = z.date
  WHERE r.state IN (0, 1, 2, 3)  -- state 0~3: 미래 사전예약률 계산용 (완료 포함 전체 예약 상태)
    AND r.member_imaginary IN (0, 9)
    AND DATE(r.start_at, "Asia/Seoul") BETWEEN CURRENT_DATE("Asia/Seoul")
                                           AND DATE_ADD(CURRENT_DATE("Asia/Seoul"), INTERVAL {future_days} DAY)
    {region1_where_z}
),

reserved_slots AS (
  SELECT
    rb.region1,
    rb.region2,
    slot,
    TIMESTAMP_DIFF(
      LEAST(TIMESTAMP_ADD(slot, INTERVAL 1 HOUR), rb.end_at),
      GREATEST(slot, rb.start_at),
      MINUTE
    ) AS occupied_minutes
  FROM reserved_base rb
  CROSS JOIN UNNEST(GENERATE_TIMESTAMP_ARRAY(
    TIMESTAMP_TRUNC(rb.start_at, HOUR),
    TIMESTAMP_TRUNC(rb.end_at,   HOUR),
    INTERVAL 1 HOUR
  )) AS slot
  WHERE slot < rb.end_at
    AND slot >= rb.start_at
),

future_reservation AS (
  SELECT
    rs.region1,
    rs.region2,
    SAFE_DIVIDE(
      SUM(rs.occupied_minutes),
      SUM(h.dp_min)
    ) AS prereserv_rate
  FROM reserved_slots rs
  JOIN `socar-data.socar_biz.operation_per_car_hourly_v2` h
    ON rs.region1  = h.region1
   AND rs.region2  = h.region2
   AND TIMESTAMP_TRUNC(slot, HOUR) = h.datetime  -- slot은 reserved_slots에서 시간별로 분해된 각 행; 여러 slot이 같은 시간대에 매핑될 수 있음
  GROUP BY rs.region1, rs.region2
)

SELECT
  o.region1,
  o.region2,
  o.util_rate,
  r.rev_per_car,
  COALESCE(f.prereserv_rate, 0) AS prereserv_rate,
  o.car_count
FROM past_operation o
JOIN past_revenue r
  ON o.region1 = r.region1 AND o.region2 = r.region2
LEFT JOIN future_reservation f
  ON o.region1 = f.region1 AND o.region2 = f.region2
ORDER BY o.region1, o.region2
