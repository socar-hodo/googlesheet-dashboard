-- 일별 지역별 사전 매출 (전국)
-- params: {start_date}, {end_date}
-- 로직: 과거 날짜는 actual(profit 테이블), 미래 날짜는 expected(reservation + charged/paid) 폴백
-- 출력: d, ulsan_forecast(울산 슬라이스), gyeongnam_forecast(경남 슬라이스), combined_forecast(전국 총합)

WITH reservation_base AS (
  SELECT
    ri.id AS reservation_id,
    cz.region1,
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
    SUM(revenue) AS _rev_total
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND car_state IN ('수리', '운영')
    AND car_sharing_type IN ('socar', 'zplus')
  GROUP BY date, region1
),

expected_daily AS (
  SELECT
    r.end_date,
    r.region1,
    SUM(e._rev_total) AS _rev_total
  FROM reservation_base r
  LEFT JOIN expected_rev e USING (reservation_id)
  GROUP BY r.end_date, r.region1
),

combined AS (
  SELECT
    n.end_date AS date,
    n.region1,
    IFNULL(ac._rev_total, n._rev_total) AS revenue
  FROM expected_daily n
  LEFT JOIN actual_rev ac
    ON n.end_date = ac.date AND n.region1 = ac.region1
)

SELECT
  FORMAT_DATE('%Y-%m-%d', date) AS d,
  SUM(CASE WHEN region1 = '울산광역시' THEN revenue ELSE 0 END) AS ulsan_forecast,
  SUM(CASE WHEN region1 = '경상남도' THEN revenue ELSE 0 END) AS gyeongnam_forecast,
  SUM(revenue) AS combined_forecast
FROM combined
GROUP BY date
ORDER BY date
