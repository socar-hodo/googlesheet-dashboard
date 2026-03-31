-- ============================================================
-- 신차 전국 배분 쿼리
-- 파라미터 (Python에서 .format()으로 치환):
--   {car_model}    : 차종 모델명 (예: 아반떼) — profit 테이블의 car_name LIKE '%{car_model}%' 로 매칭
--   {car_segment}  : 차종 세그먼트 (예: 준중형) — profit 테이블의 car_model 컬럼과 일치
--   {total_cars}   : 총 배분 물량 (정수)
--   {base_date}    : 기준 날짜 (YYYY-MM-DD)
--   {alpha}        : 가중치 (수익, 0.3~0.7)
--
-- 테이블 구조 참고:
--   profit_socar_car_daily.car_model  = 세그먼트명 (준중형, 중형, SUV 등)
--   profit_socar_car_daily.car_name   = 차량명 (더 뉴 아반떼, 쏘나타 센슈어스 등)
--
-- 제외 지역: 제주특별자치도, 평안북도
-- ============================================================

WITH

-- 1. 기준 기간 정의
date_range AS (
  SELECT
    DATE('{base_date}')                                          AS base_date,
    DATE_SUB(DATE('{base_date}'), INTERVAL 90 DAY)               AS cur_start,
    DATE_SUB(DATE('{base_date}'), INTERVAL 1 DAY)                AS cur_end,
    DATE_SUB(DATE('{base_date}'), INTERVAL 90 + 364 DAY)         AS yoy_start,
    DATE_SUB(DATE('{base_date}'), INTERVAL 1   + 364 DAY)        AS yoy_end
)
,

-- 2. 광역별 모델 운영 대수 (car_name LIKE 패턴으로 특정 모델 식별)
--    제주특별자치도, 평안북도는 배분 대상에서 제외
car_count_model AS (
  SELECT
    p.region1,
    p.region2,
    COUNT(DISTINCT p.car_id) AS model_car_count
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.cur_start AND d.cur_end
    AND p.car_name LIKE '%{car_model}%'
    AND p.car_model = '{car_segment}'
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND p.region1 != '제주특별자치도'
    AND p.region1 != '평안북도'
  GROUP BY p.region1, p.region2
),

car_count_segment AS (
  SELECT
    p.region1,
    p.region2,
    COUNT(DISTINCT p.car_id) AS seg_car_count
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.cur_start AND d.cur_end
    AND p.car_model = '{car_segment}'
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND p.region1 != '제주특별자치도'
    AND p.region1 != '평안북도'
  GROUP BY p.region1, p.region2
),

-- 참조 기준 결정: model(5대↑) → segment(5대↑) → fallback
car_type_ref AS (
  SELECT
    COALESCE(cm.region1, cs.region1) AS region1,
    COALESCE(cm.region2, cs.region2) AS region2,
    CASE
      WHEN COALESCE(cm.model_car_count, 0) >= 5 THEN 'model'
      WHEN COALESCE(cs.seg_car_count,   0) >= 5 THEN 'segment'
      ELSE 'fallback'
    END AS ref_type,
    COALESCE(cm.model_car_count, 0) AS model_car_count,
    COALESCE(cs.seg_car_count,   0) AS seg_car_count
  FROM car_count_model cm
  FULL OUTER JOIN car_count_segment cs USING (region1, region2)
),

-- 3. 현재 기간 수익
current_rev AS (
  SELECT
    p.region1,
    p.region2,
    ref.ref_type,
    SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS rev_per_car
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  JOIN car_type_ref ref ON p.region1 = ref.region1 AND p.region2 = ref.region2
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.cur_start AND d.cur_end
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND (
      (ref.ref_type = 'model'   AND p.car_name LIKE '%{car_model}%')
      OR (ref.ref_type = 'segment' AND p.car_model = '{car_segment}')
      OR (ref.ref_type = 'fallback')
    )
  GROUP BY p.region1, p.region2, ref.ref_type
),

-- 4. 현재 기간 가동률
current_util AS (
  SELECT
    p.region1,
    p.region2,
    ref.ref_type,
    SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS util_rate
  FROM `socar-data.socar_biz.operation_per_car_daily_v2` o
  JOIN `socar-data.socar_biz_profit.profit_socar_car_daily` p
    ON o.date = p.date AND o.car_id = p.car_id
  JOIN car_type_ref ref ON p.region1 = ref.region1 AND p.region2 = ref.region2
  CROSS JOIN date_range d
  WHERE o.date BETWEEN d.cur_start AND d.cur_end
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND (
      (ref.ref_type = 'model'   AND p.car_name LIKE '%{car_model}%')
      OR (ref.ref_type = 'segment' AND p.car_model = '{car_segment}')
      OR (ref.ref_type = 'fallback')
    )
  GROUP BY p.region1, p.region2, ref.ref_type
)
,

-- 5. 전년 동기 수익
yoy_rev AS (
  SELECT
    p.region1,
    p.region2,
    ref.ref_type,
    SUM(p.revenue)  AS yoy_revenue_sum,
    SUM(p.opr_day)  AS yoy_opr_day_sum,
    SAFE_DIVIDE(SUM(p.revenue), SUM(p.opr_day)) AS yoy_rev_per_car
  FROM `socar-data.socar_biz_profit.profit_socar_car_daily` p
  JOIN car_type_ref ref ON p.region1 = ref.region1 AND p.region2 = ref.region2
  CROSS JOIN date_range d
  WHERE p.date BETWEEN d.yoy_start AND d.yoy_end
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND (
      (ref.ref_type = 'model'   AND p.car_name LIKE '%{car_model}%')
      OR (ref.ref_type = 'segment' AND p.car_model = '{car_segment}')
      OR  ref.ref_type = 'fallback'
    )
  GROUP BY p.region1, p.region2, ref.ref_type
),

-- 6. 전년 동기 가동률
yoy_util AS (
  SELECT
    p.region1,
    p.region2,
    ref.ref_type,
    SUM(o.dp_min)   AS yoy_dp_min_sum,
    SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS yoy_util_rate
  FROM `socar-data.socar_biz.operation_per_car_daily_v2` o
  JOIN `socar-data.socar_biz_profit.profit_socar_car_daily` p
    ON o.date = p.date AND o.car_id = p.car_id
  JOIN car_type_ref ref ON p.region1 = ref.region1 AND p.region2 = ref.region2
  CROSS JOIN date_range d
  WHERE o.date BETWEEN d.yoy_start AND d.yoy_end
    AND p.car_sharing_type IN ('socar', 'zplus')
    AND p.car_state IN ('운영', '수리')
    AND (
      (ref.ref_type = 'model'   AND p.car_name LIKE '%{car_model}%')
      OR (ref.ref_type = 'segment' AND p.car_model = '{car_segment}')
      OR  ref.ref_type = 'fallback'
    )
  GROUP BY p.region1, p.region2, ref.ref_type
),

-- 7. 전국 세그먼트 평균 (fallback 광역에 적용할 원점수)
fallback_stats AS (
  SELECT
    AVG(r.rev_per_car)  AS avg_rev_per_car,
    AVG(u.util_rate)    AS avg_util_rate
  FROM current_rev r
  JOIN current_util u USING (region1, region2)
  WHERE r.ref_type != 'fallback'
)
,

-- 8. YoY 계산 + 예외처리 (캡, 신뢰도 낮은 지역 중립화)
metrics AS (
  SELECT
    r.region1,
    r.region2,
    r.ref_type,

    -- 수익 원점수용 값
    CASE WHEN r.ref_type = 'fallback' THEN fb.avg_rev_per_car
         ELSE r.rev_per_car END                                   AS rev_per_car,

    -- 수익 YoY: 신뢰도 낮은 경우 1.0, 캡 처리
    CASE
      WHEN r.ref_type = 'fallback'                                THEN 1.0
      WHEN yr.yoy_opr_day_sum IS NULL OR yr.yoy_opr_day_sum < 30  THEN 1.0
      WHEN yr.yoy_rev_per_car IS NULL OR yr.yoy_rev_per_car = 0   THEN 1.0
      ELSE LEAST(2.0, GREATEST(0.5,
             SAFE_DIVIDE(r.rev_per_car, yr.yoy_rev_per_car)))
    END                                                            AS rev_yoy,

    -- 가동률 원점수용 값
    -- COALESCE: current_rev에 있지만 current_util에 없는 광역 보호 (NULL → fallback 평균 적용)
    CASE WHEN r.ref_type = 'fallback'    THEN fb.avg_util_rate
         WHEN u.util_rate IS NULL        THEN fb.avg_util_rate
         ELSE u.util_rate END                                      AS util_rate,

    -- 가동률 YoY: 신뢰도 낮은 경우 1.0, 캡 처리
    CASE
      WHEN r.ref_type = 'fallback'                                THEN 1.0
      WHEN yu.yoy_dp_min_sum IS NULL OR yu.yoy_dp_min_sum < 43200 THEN 1.0
      WHEN yu.yoy_util_rate  IS NULL OR yu.yoy_util_rate  = 0     THEN 1.0
      ELSE LEAST(2.0, GREATEST(0.5,
             SAFE_DIVIDE(u.util_rate, yu.yoy_util_rate)))
    END                                                            AS util_yoy

  FROM current_rev r
  LEFT JOIN current_util u      USING (region1, region2)
  LEFT JOIN yoy_rev yr          USING (region1, region2)
  LEFT JOIN yoy_util yu         USING (region1, region2)
  CROSS JOIN fallback_stats fb
),

-- 9. 원점수 계산 (rev_yoy, util_yoy도 pass-through — Python의 YoY 캡 탐지용)
raw_scores AS (
  SELECT
    region1,
    region2,
    ref_type,
    rev_per_car * rev_yoy   AS rev_raw,
    util_rate   * util_yoy  AS util_raw,
    rev_yoy,
    util_yoy
  FROM metrics
)
,

-- 10. 윈저라이징 경계값 계산 (폴백 제외 모집단, 상/하위 5%)
-- DISTINCT + LIMIT 1 패턴: BigQuery에서 집계함수와 윈도우함수 혼용 방지
winsorize_bounds AS (
  SELECT DISTINCT
    PERCENTILE_CONT(rev_raw,  0.05) OVER() AS rev_p05,
    PERCENTILE_CONT(rev_raw,  0.95) OVER() AS rev_p95,
    PERCENTILE_CONT(util_raw, 0.05) OVER() AS util_p05,
    PERCENTILE_CONT(util_raw, 0.95) OVER() AS util_p95
  FROM raw_scores
  WHERE ref_type != 'fallback'
  LIMIT 1
),

-- 11. 윈서라이징 적용
winsorized AS (
  SELECT
    r.region1,
    r.region2,
    r.ref_type,
    r.rev_yoy,
    r.util_yoy,
    CASE WHEN r.ref_type = 'fallback' THEN r.rev_raw
         ELSE LEAST(b.rev_p95, GREATEST(b.rev_p05, r.rev_raw))
    END AS rev_w,
    CASE WHEN r.ref_type = 'fallback' THEN r.util_raw
         ELSE LEAST(b.util_p95, GREATEST(b.util_p05, r.util_raw))
    END AS util_w
  FROM raw_scores r
  CROSS JOIN winsorize_bounds b
),

-- 12. Min-Max 정규화 경계값 (폴백 제외 모집단)
norm_bounds AS (
  SELECT
    MIN(rev_w)  AS rev_min,  MAX(rev_w)  AS rev_max,
    MIN(util_w) AS util_min, MAX(util_w) AS util_max,
    AVG(rev_w)  AS rev_avg,  AVG(util_w) AS util_avg
  FROM winsorized
  WHERE ref_type != 'fallback'
),

-- 13. Min-Max 정규화 (폴백은 평균 점수로 클리핑)
normalized AS (
  SELECT
    w.region1,
    w.region2,
    w.ref_type,
    w.rev_yoy,
    w.util_yoy,
    CASE
      WHEN w.ref_type = 'fallback'
        THEN SAFE_DIVIDE(b.rev_avg  - b.rev_min,  NULLIF(b.rev_max  - b.rev_min,  0))
      ELSE SAFE_DIVIDE(w.rev_w  - b.rev_min,  NULLIF(b.rev_max  - b.rev_min,  0))
    END AS rev_norm,
    CASE
      WHEN w.ref_type = 'fallback'
        THEN SAFE_DIVIDE(b.util_avg - b.util_min, NULLIF(b.util_max - b.util_min, 0))
      ELSE SAFE_DIVIDE(w.util_w - b.util_min, NULLIF(b.util_max - b.util_min, 0))
    END AS util_norm
  FROM winsorized w
  CROSS JOIN norm_bounds b
)
,

-- 14. 민감도 분석 (α = 0.3 ~ 0.7, 5개 시나리오)
sensitivity AS (
  SELECT
    region1,
    region2,
    ref_type,
    rev_norm,
    util_norm,
    rev_yoy,
    util_yoy,
    0.3 * rev_norm + 0.7 * util_norm AS score_s1,
    0.4 * rev_norm + 0.6 * util_norm AS score_s2,
    0.5 * rev_norm + 0.5 * util_norm AS score_s3,
    0.6 * rev_norm + 0.4 * util_norm AS score_s4,
    0.7 * rev_norm + 0.3 * util_norm AS score_s5,
    RANK() OVER (ORDER BY (0.3 * rev_norm + 0.7 * util_norm) DESC) AS rank_s1,
    RANK() OVER (ORDER BY (0.7 * rev_norm + 0.3 * util_norm) DESC) AS rank_s5
  FROM normalized
)
,

-- 15. 최종 배분 점수 ({alpha}는 Python에서 치환, 기본 0.5)
final_scores AS (
  SELECT
    region1,
    region2,
    ref_type,
    rev_yoy,
    util_yoy,
    {alpha} * rev_norm + (1 - {alpha}) * util_norm AS score,
    score_s1, score_s2, score_s3, score_s4, score_s5,
    rank_s1, rank_s5
  FROM sensitivity
),

-- 16. 총점 합산
score_sum AS (
  SELECT SUM(score) AS total_score FROM final_scores
),

-- 17. 배분 대수 (반올림, SUM=0 시 균등 배분)
allocation_raw AS (
  SELECT
    f.region1,
    f.region2,
    f.ref_type,
    f.score,
    f.rev_yoy,
    f.util_yoy,
    f.score_s1, f.score_s2, f.score_s3, f.score_s4, f.score_s5,
    f.rank_s1, f.rank_s5,
    CASE
      WHEN s.total_score = 0
        THEN ROUND({total_cars} / COUNT(*) OVER())
      ELSE ROUND(SAFE_DIVIDE(f.score, s.total_score) * {total_cars})
    END AS allocated_raw,
    CASE WHEN s.total_score = 0 THEN TRUE ELSE FALSE END AS is_equal_dist
  FROM final_scores f
  CROSS JOIN score_sum s
),

-- 18. 반올림 합계 보정 (점수 상위 광역부터 1대씩 조정, 동점 시 가나다순)
allocation_adj AS (
  SELECT
    region1,
    region2,
    ref_type,
    score,
    rev_yoy,
    util_yoy,
    allocated_raw,
    is_equal_dist,
    score_s1, score_s2, score_s3, score_s4, score_s5,
    rank_s1, rank_s5,
    SUM(allocated_raw) OVER()                                                     AS total_allocated,
    ROW_NUMBER() OVER (ORDER BY score DESC, region1 ASC, region2 ASC)             AS rank_for_adj
  FROM allocation_raw
)

-- 최종 출력
SELECT
  region1,
  region2,
  ref_type,
  ROUND(score, 4)  AS final_score,
  rev_yoy,
  util_yoy,
  allocated_raw
  + CASE
      WHEN rank_for_adj <= ({total_cars} - total_allocated) THEN 1
      WHEN rank_for_adj <= (total_allocated - {total_cars}) THEN -1
      ELSE 0
    END              AS allocated_cars,
  is_equal_dist,
  ROUND(score_s1, 4) AS score_s1,
  ROUND(score_s2, 4) AS score_s2,
  ROUND(score_s3, 4) AS score_s3,
  ROUND(score_s4, 4) AS score_s4,
  ROUND(score_s5, 4) AS score_s5,
  rank_s1,
  rank_s5
FROM allocation_adj
ORDER BY final_score DESC, region1 ASC, region2 ASC
