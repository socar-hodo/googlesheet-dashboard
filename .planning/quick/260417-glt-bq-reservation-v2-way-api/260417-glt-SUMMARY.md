# Quick Task 260417-glt: 고객 유형 분석 BQ 직접 연동 — Summary

**Completed:** 2026-04-17
**Status:** Done (pending human verification)

## What Changed

### New Files
- `sql/customer-type/daily.sql` — 일별 왕복/배달/편도 건수 집계 (reservation_v2, way 기준)
- `sql/customer-type/weekly.sql` — 주별 집계 (ISO week → "N월 N주차" 포맷)
- `lib/customer-type.ts` — SQL 로딩 + BQ row → CustomerTypeRow 변환
- `app/api/customer-type/route.ts` — GET /api/customer-type (withAuth, 지역/날짜 필터)

### Modified Files
- `components/dashboard/charts/customer-type-section.tsx` — BQ API fetch + Sheets 폴백 + 로딩 스켈레톤
- `next.config.ts` — outputFileTracingIncludes에 /api/customer-type 추가

## API Specification

```
GET /api/customer-type?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&region1=&zone_ids=1,2,3

Response:
{
  daily: [{ date: "2026-04-01", roundTripCount: 10, callCount: 3, oneWayCount: 2 }, ...],
  weekly: [{ week: "4월 2주차", roundTripCount: 70, callCount: 21, oneWayCount: 14 }, ...]
}
```

## Design Decisions
- **BQ 우선, Sheets 폴백**: BQ 데이터 로드 실패 시 기존 Google Sheets 데이터로 graceful degradation
- **way 매핑**: `general` → 왕복, `d2d_round` → 배달, `d2d_oneway` → 편도
- **90일 기본 범위**: 프론트엔드에서 90일 전~어제로 fetch, 일별/주별 모두 한 번에 반환
