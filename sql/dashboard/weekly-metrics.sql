-- 주차별 메트릭 + 매출·비용 세분화 통합 (전국)
-- params: {start_date}, {end_date}
-- week format: "N월 M주차" (프론트엔드 호환)

WITH profit AS (
  SELECT
    date,
    SUM(revenue) AS revenue,
    SUM(profit) AS profit,
    SUM(utime) AS usage_hours,
    SUM(nuse) AS usage_count,
    SUM(opr_day) AS opr_day,
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
    ) AS commission_cost,
    SUM(cost_wash) AS wash_cost,
    SUM(cost_maintenance) AS maintenance_cost,
    SUM(cost_repair_vehicle) AS repair_cost,
    SUM(cost_insurance) AS insurance_cost,
    SUM(cost_tax_vehicle) AS tax_cost,
    SUM(
      COALESCE(cost_communication_mobility, 0)
      + COALESCE(cost_communication_telephone, 0)
    ) AS communication_cost,
    SUM(cost_charge_ev) AS charge_ev_cost
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily`
  WHERE date BETWEEN '{start_date}' AND '{end_date}'
    AND car_sharing_type IN ('socar', 'zplus')
    AND car_state IN ('운영', '수리')
    {region_filter}
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
    {region_filter}
  GROUP BY date
),

merged AS (
  SELECT
    p.date,
    p.revenue, p.profit, p.usage_hours, p.usage_count, p.opr_day,
    p.rental_revenue, p.pf_revenue, p.driving_revenue, p.call_revenue, p.other_revenue,
    p.transport_cost, p.fuel_cost, p.parking_cost, p.inspection_cost, p.depreciation_cost, p.commission_cost,
    p.wash_cost, p.maintenance_cost, p.repair_cost, p.insurance_cost, p.tax_cost, p.communication_cost, p.charge_ev_cost,
    o.op_min, o.dp_min
  FROM profit p
  LEFT JOIN operation o USING (date)
)

SELECT
  CONCAT(
    CAST(EXTRACT(MONTH FROM DATE_TRUNC(date, ISOWEEK)) AS STRING),
    '월 ',
    CAST(DIV(EXTRACT(DAY FROM DATE_TRUNC(date, ISOWEEK)) - 1, 7) + 1 AS STRING),
    '주차'
  ) AS week_label,
  EXTRACT(ISOYEAR FROM date) AS iso_year,
  EXTRACT(ISOWEEK FROM date) AS iso_week,
  SUM(revenue) AS revenue,
  SUM(profit) AS profit,
  SUM(usage_hours) AS usage_hours,
  SUM(usage_count) AS usage_count,
  SUM(opr_day) AS opr_day,
  SAFE_DIVIDE(SUM(revenue), SUM(opr_day)) AS revenue_per_car,
  SAFE_DIVIDE(SUM(usage_count), SUM(opr_day)) AS usage_count_per_car,
  SAFE_DIVIDE(SUM(usage_hours), SUM(opr_day)) AS usage_hours_per_car,
  SAFE_DIVIDE(SUM(op_min), SUM(dp_min)) * 100 AS utilization_rate,
  SUM(rental_revenue) AS rental_revenue,
  SUM(pf_revenue) AS pf_revenue,
  SUM(driving_revenue) AS driving_revenue,
  SUM(call_revenue) AS call_revenue,
  SUM(other_revenue) AS other_revenue,
  SUM(transport_cost) AS transport_cost,
  SUM(fuel_cost) AS fuel_cost,
  SUM(parking_cost) AS parking_cost,
  SUM(inspection_cost) AS inspection_cost,
  SUM(depreciation_cost) AS depreciation_cost,
  SUM(commission_cost) AS commission_cost,
  SUM(wash_cost) AS wash_cost,
  SUM(maintenance_cost) AS maintenance_cost,
  SUM(repair_cost) AS repair_cost,
  SUM(insurance_cost) AS insurance_cost,
  SUM(tax_cost) AS tax_cost,
  SUM(communication_cost) AS communication_cost,
  SUM(charge_ev_cost) AS charge_ev_cost
FROM merged
GROUP BY iso_year, iso_week, week_label
ORDER BY iso_year, iso_week
