-- 일별 메트릭 + 매출·비용 세분화 통합 (전국)
-- params: {start_date}, {end_date}
-- 출력: date, revenue/profit/usage_hours/usage_count/utilization_rate
--      + revenue breakdown (rental/pf/driving/call/other)
--      + cost breakdown (transport/fuel/parking/inspection/depreciation/commission)

WITH profit AS (
  SELECT
    date,
    SUM(revenue) AS revenue,
    SUM(profit) AS profit,
    SUM(utime) AS usage_hours,
    SUM(nuse) AS usage_count,
    SUM(_rev_rent) AS rental_revenue,
    SUM(_rev_pf) AS pf_revenue,
    SUM(_rev_oil) AS driving_revenue,
    SUM(_rev_d2d) AS call_revenue,
    SUM(_rev_etc) AS other_revenue,
    SUM(COALESCE(cost_transport, 0) + COALESCE(cost_transport_mobility, 0)) AS transport_cost,
    SUM(cost_fuel) AS fuel_cost,
    SUM(COALESCE(cost_parking_zone, 0) + COALESCE(cost_parking_etc, 0)) AS parking_cost,
    SUM(cost_inspection) AS inspection_cost,
    SUM(cost_depreciation) AS depreciation_cost,
    SUM(
      COALESCE(cost_commission_admin, 0)
      + COALESCE(cost_commission_pg, 0)
      + COALESCE(cost_commission_callcenter, 0)
    ) AS commission_cost
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND car_sharing_type IN ('socar', 'zplus')
    AND car_state IN ('운영', '수리')
  GROUP BY date
),

operation AS (
  SELECT
    date,
    SUM(op_min) AS op_min,
    SUM(dp_min) AS dp_min
  FROM `socar-data.socar_biz.operation_per_car_daily_v2`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND sharing_type IN ('socar', 'zplus')
  GROUP BY date
)

SELECT
  FORMAT_DATE('%Y-%m-%d', p.date) AS d,
  p.revenue,
  p.profit,
  p.usage_hours,
  p.usage_count,
  SAFE_DIVIDE(o.op_min, o.dp_min) * 100 AS utilization_rate,
  p.rental_revenue,
  p.pf_revenue,
  p.driving_revenue,
  p.call_revenue,
  p.other_revenue,
  p.transport_cost,
  p.fuel_cost,
  p.parking_cost,
  p.inspection_cost,
  p.depreciation_cost,
  p.commission_cost
FROM profit p
LEFT JOIN operation o USING (date)
ORDER BY p.date
