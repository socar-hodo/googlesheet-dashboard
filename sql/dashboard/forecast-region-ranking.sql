-- 지역별 사전 매출 랭킹 (actual 우선 + expected 폴백)
-- params: {start_date}, {end_date}, {group_field}, {parent_filter}
-- group_field: region1 또는 region2
-- parent_filter 예시:
--   전국 랭킹:                    ''
--   region1 drill → region2 랭킹: "AND region1 = '서울특별시'"

WITH reservation_base AS (
  SELECT
    ri.id AS reservation_id,
    cz.region1,
    cz.region2,
    CASE WHEN ri.state = 3 THEN DATE(ri.return_at, "Asia/Seoul")
         ELSE DATE(IFNULL(ri.reserved_end_at, ri.end_at), "Asia/Seoul") END AS end_date
  FROM `socar-data.tianjin_replica.reservation_info` ri
  LEFT JOIN `socar-data.tianjin_replica.carzone_info` cz
    ON ri.zone_id = cz.id
  WHERE ri.state IN (1, 2, 3)
    AND ri.member_imaginary IN (0, 9)
    AND ri.way IN ('round', 'z2d_oneway', 'd2d_oneway', 'd2d_round', 'd2d_rev')
    AND DATE(IFNULL(ri.return_at, ri.end_at), 'Asia/Seoul')
        BETWEEN '{start_date}' AND '{end_date}'
    {parent_filter}
),

expected_rev AS (
  SELECT
    reservation_id,
    SUM(_rev_rent + _rev_pf + _rev_oil + _rev_d2d + _rev_etc + _credit_discount) AS _rev_total
  FROM (
    SELECT reservation_id,
      CASE WHEN charge_type IN ('rent', 'refund') THEN amount - vat ELSE 0 END AS _rev_rent,
      CASE WHEN charge_type = 'protection_fee' THEN amount - vat ELSE 0 END AS _rev_pf,
      CASE WHEN charge_type = 'oil' THEN amount - vat ELSE 0 END AS _rev_oil,
      CASE WHEN charge_type IN ('d2d_fee', 'd2d_return_fee') THEN amount - vat ELSE 0 END AS _rev_d2d,
      CASE WHEN charge_type = 'penalty' THEN amount - vat ELSE 0 END AS _rev_etc,
      0 AS _credit_discount
    FROM `socar-data.tianjin_replica.charged_info`
    WHERE DATE(created_at, 'Asia/Seoul') >= DATE_SUB(DATE '{start_date}', INTERVAL 90 DAY)

    UNION ALL

    SELECT reservation_id,
      CASE WHEN paid_type IN ('coupon', 'coupon_fund', 'bonus') THEN (amount - vat) * -1 ELSE 0 END AS _rev_rent,
      0, 0, 0, 0,
      CASE WHEN paid_type = 'credit' THEN (amount - vat) * -1 ELSE 0 END AS _credit_discount
    FROM `socar-data.tianjin_replica.paid_info`
    WHERE DATE(created_at, 'Asia/Seoul') >= DATE_SUB(DATE '{start_date}', INTERVAL 90 DAY)
  ) x
  GROUP BY reservation_id
),

actual_rev AS (
  SELECT
    date,
    region1,
    region2,
    SUM(revenue) AS _rev_total
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND car_state IN ('수리', '운영')
    AND car_sharing_type IN ('socar', 'zplus')
    {parent_filter}
  GROUP BY date, region1, region2
),

expected_daily AS (
  SELECT
    r.end_date,
    r.region1,
    r.region2,
    SUM(e._rev_total) AS _rev_total
  FROM reservation_base r
  LEFT JOIN expected_rev e USING (reservation_id)
  GROUP BY r.end_date, r.region1, r.region2
),

combined AS (
  SELECT
    COALESCE(ac.region1, ed.region1) AS region1,
    COALESCE(ac.region2, ed.region2) AS region2,
    IFNULL(ac._rev_total, ed._rev_total) AS revenue
  FROM expected_daily ed
  FULL OUTER JOIN actual_rev ac
    ON ed.end_date = ac.date
    AND ed.region1 = ac.region1
    AND ed.region2 = ac.region2
)

SELECT
  {group_field} AS region,
  SUM(revenue) AS revenue
FROM combined
WHERE {group_field} IS NOT NULL AND {group_field} != ''
GROUP BY region
ORDER BY revenue DESC
