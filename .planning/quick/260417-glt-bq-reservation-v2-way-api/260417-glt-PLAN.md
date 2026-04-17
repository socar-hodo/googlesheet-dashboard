---
phase: quick
plan: 260417-glt
type: execute
wave: 1
depends_on: []
files_modified:
  - sql/customer-type/daily.sql
  - sql/customer-type/weekly.sql
  - lib/customer-type.ts
  - app/api/customer-type/route.ts
  - components/dashboard/charts/customer-type-section.tsx
  - next.config.ts
autonomous: false
requirements: [BQ-CUSTOMER-TYPE]

must_haves:
  truths:
    - "고객 유형 도넛 차트에 왕복/배달/편도 분포가 실제 BQ 데이터로 표시된다"
    - "유형별 이용건수 추이 차트에 일별/주별 stacked bar가 BQ 데이터로 렌더링된다"
    - "지역 필터(부산/경남/울산)가 API에 적용된다"
  artifacts:
    - path: "sql/customer-type/daily.sql"
      provides: "일별 왕복/배달/편도 건수 집계 쿼리"
      contains: "reservation_v2"
    - path: "sql/customer-type/weekly.sql"
      provides: "주별 왕복/배달/편도 건수 집계 쿼리"
      contains: "reservation_v2"
    - path: "lib/customer-type.ts"
      provides: "SQL 로딩 + BQ row -> CustomerTypeRow 변환"
      exports: ["loadCustomerTypeSql", "buildCustomerTypeResponse"]
    - path: "app/api/customer-type/route.ts"
      provides: "GET /api/customer-type — daily+weekly 데이터 반환"
      exports: ["GET"]
  key_links:
    - from: "components/dashboard/charts/customer-type-section.tsx"
      to: "/api/customer-type"
      via: "fetch in useEffect"
      pattern: "fetch.*api/customer-type"
    - from: "app/api/customer-type/route.ts"
      to: "lib/customer-type.ts"
      via: "loadCustomerTypeSql + runParameterizedQuery"
    - from: "lib/customer-type.ts"
      to: "sql/customer-type/*.sql"
      via: "readFileSync"
---

<objective>
고객 유형 분석 차트(도넛 + 추이)가 현재 Google Sheets 데이터를 참조하지만, 시트에 해당 컬럼이 없어 "데이터 없음" 상태이다. BigQuery `reservation_v2` 테이블에서 way 기준으로 왕복/배달/편도 건수를 직접 집계하는 API를 추가하고, 프론트엔드에서 이 API를 호출하도록 변경한다.

Purpose: 고객 유형 분석 섹션에 실제 예약 데이터를 표시하여 대시보드 기능 완성
Output: BQ API 엔드포인트 + 프론트엔드 연동 완료
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>

Working directory: `C:\Users\socar\googlesheet-dashboard`

### Existing BQ Pattern (follow exactly)

**lib/bigquery.ts** — `runQuery()`, `runParameterizedQuery()` with `QueryParam`/`ArrayQueryParam` types
**lib/api-utils.ts** — `withAuth()` wrapper for all API routes
**lib/funnel.ts** — SQL file loading pattern: `readFileSync(resolve(process.cwd(), "sql/...", filename))`
**lib/zone.ts** — Parameterized query pattern with `@param` syntax

### Frontend Contract (NO CHANGES to these files)

`CustomerTypeRow` from `types/dashboard.ts`:
```typescript
export interface CustomerTypeRow {
  date?: string;           // 일별 (YYYY-MM-DD). 주차별이면 undefined
  week?: string;           // 주차별. 일별이면 undefined
  roundTripCount: number;  // 왕복_건수
  callCount: number;       // 배달_건수
  oneWayCount: number;     // 편도_건수
}
```

`CustomerTypeSection` expects `{ daily: CustomerTypeRow[], weekly: CustomerTypeRow[], tab }`.

### BQ Query Reference

- Table: `socar-data.soda_store.reservation_v2`
- Project ID: `hodo-op-sim` (cross-project query)
- way mapping: `'general'` -> roundTrip, `'d2d_round'` -> call(배달), `'d2d_oneway'` -> oneWay(편도)
- Filters: `state IN (3, 5)`, `member_imaginary IN (0, 9)`
- Region join: `socar-data.socar_biz_base.carzone_info_daily` (key: `id` = zone_id)

### next.config.ts SQL tracing

All `/api/*` routes that load SQL files need an entry in `outputFileTracingIncludes`:
```typescript
"/api/customer-type": ["./sql/**/*.sql"],
```

</context>

<tasks>

<task type="auto">
  <name>Task 1: SQL + lib 모듈 + API 라우트 생성</name>
  <files>
    sql/customer-type/daily.sql
    sql/customer-type/weekly.sql
    lib/customer-type.ts
    app/api/customer-type/route.ts
    next.config.ts
  </files>
  <action>
**1) `sql/customer-type/daily.sql`** — 일별 왕복/배달/편도 건수 집계.

```sql
-- 일별 고객 유형(way)별 이용건수
-- params: @start_date (DATE), @end_date (DATE)
-- optional: @region1 (STRING), @zone_ids (ARRAY<INT64>)
```

쿼리 설계:
- `reservation_v2` r에서 `rent_start_at` 기준 DATE로 GROUP BY
- `state IN (3, 5)` AND `member_imaginary IN (0, 9)` 필터
- COUNTIF 패턴으로 way별 건수 집계:
  - `COUNTIF(r.way = 'general') AS round_trip_count`
  - `COUNTIF(r.way IN ('d2d_round')) AS call_count`
  - `COUNTIF(r.way = 'd2d_oneway') AS one_way_count`
- 지역 필터링: `carzone_info_daily` z와 LEFT JOIN (z.id = r.zone_id, z.date = DATE(r.rent_start_at, 'Asia/Seoul'))
  - WHERE 절에 조건부 region1 필터: `(@region1 = '' OR z.region1 = @region1)`
  - zone_ids 배열이 비어있지 않으면: `(ARRAY_LENGTH(@zone_ids) = 0 OR r.zone_id IN UNNEST(@zone_ids))`
- ORDER BY date ASC
- **주의**: 한글 alias 불가 — 영문 snake_case만 사용

**2) `sql/customer-type/weekly.sql`** — 주별 집계.

daily.sql과 동일 로직이지만:
- GROUP BY를 ISO week 기준으로 변경
- ISO week: `EXTRACT(ISOWEEK FROM DATE(r.rent_start_at, 'Asia/Seoul'))` + `EXTRACT(ISOYEAR ...)`
- week 컬럼 형식: `CONCAT(CAST(iso_year AS STRING), '-W', LPAD(CAST(iso_week AS STRING), 2, '0'))` (예: "2026-W16")
- ORDER BY iso_year, iso_week ASC

**3) `lib/customer-type.ts`** — SQL 로딩 + 응답 빌드.

`lib/funnel.ts` 패턴을 따라:
- `import "server-only"` 최상단
- `_sqlCache` Map으로 SQL 파일 캐시
- `loadCustomerTypeSql(filename)`: readFileSync resolve cwd + "sql/customer-type"
- `safeInt(v)`: Number 변환, 비유한 값은 0
- `buildCustomerTypeDailyResponse(rows)`: BQ 결과를 `CustomerTypeRow[]`로 변환 (date 매핑)
- `buildCustomerTypeWeeklyResponse(rows)`: BQ 결과를 `CustomerTypeRow[]`로 변환 (week 매핑)

**4) `app/api/customer-type/route.ts`** — GET 핸들러.

```typescript
export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date") || defaultStartDate(); // 30일 전
  const endDate = sp.get("end_date") || defaultEndDate();       // 어제
  const region1 = sp.get("region1") || "";
  // zone_ids는 comma-separated: "123,456"
  const zoneIds = sp.get("zone_ids")?.split(",").map(Number).filter(n => !isNaN(n)) || [];

  // 파라미터 바인딩 (runParameterizedQuery)
  const params = [
    { name: "start_date", type: "DATE", value: startDate },
    { name: "end_date", type: "DATE", value: endDate },
    { name: "region1", type: "STRING", value: region1 },
    { name: "zone_ids", type: "INT64", values: zoneIds },
  ];

  const dailySql = loadCustomerTypeSql("daily.sql");
  const weeklySql = loadCustomerTypeSql("weekly.sql");

  // 병렬 실행
  const [dailyRows, weeklyRows] = await Promise.all([
    runParameterizedQuery(dailySql, params),
    runParameterizedQuery(weeklySql, params),
  ]);

  return NextResponse.json({
    daily: dailyRows ? buildCustomerTypeDailyResponse(dailyRows) : [],
    weekly: weeklyRows ? buildCustomerTypeWeeklyResponse(weeklyRows) : [],
  });
});
```

**5) `next.config.ts`** — outputFileTracingIncludes에 추가:

```typescript
"/api/customer-type": ["./sql/**/*.sql"],
```

기존 항목들 아래에 추가한다.
  </action>
  <verify>
    <automated>cd C:\Users\socar\googlesheet-dashboard && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - sql/customer-type/daily.sql, weekly.sql 생성 완료
    - lib/customer-type.ts 가 server-only, SQL 로딩, 응답 빌드 함수 export
    - app/api/customer-type/route.ts 가 withAuth GET 핸들러 export
    - next.config.ts에 /api/customer-type tracing 추가
    - TypeScript 컴파일 에러 없음
  </done>
</task>

<task type="auto">
  <name>Task 2: 프론트엔드 BQ API 연동 — CustomerTypeSection을 fetch 기반으로 전환</name>
  <files>
    components/dashboard/charts/customer-type-section.tsx
  </files>
  <action>
`CustomerTypeSection`을 수정하여 props 데이터 대신 BQ API를 직접 호출하도록 변경한다.

**변경 전**: props로 `daily`, `weekly` 배열을 받아 그대로 렌더링
**변경 후**: 컴포넌트 마운트 시 `/api/customer-type` fetch, 로딩/에러 상태 관리

수정 내용:

1. **State 추가**: `useState`로 `bqDaily`, `bqWeekly`, `loading`, `error` 관리
2. **useEffect**로 API 호출:
   ```typescript
   useEffect(() => {
     setLoading(true);
     fetch("/api/customer-type?start_date=...&end_date=...")
       .then(res => res.json())
       .then(data => {
         setBqDaily(data.daily);
         setBqWeekly(data.weekly);
       })
       .catch(err => setError(err.message))
       .finally(() => setLoading(false));
   }, []);
   ```
   - start_date: 90일 전 (넉넉하게), end_date: 어제
   - region1: props로 전달받거나 비워둠 (현재 대시보드는 경남+울산 전체이므로 빈값)

3. **Props 인터페이스 유지** (호환성):
   - `daily`, `weekly` props는 **폴백 용도**로만 사용
   - BQ 데이터 로드 성공 시 BQ 데이터 우선, 실패 시 props 데이터(Google Sheets) 폴백
   ```typescript
   interface CustomerTypeSectionProps {
     daily: CustomerTypeRow[];   // Sheets 폴백
     weekly: CustomerTypeRow[];  // Sheets 폴백
     tab: 'daily' | 'weekly';
   }
   ```

4. **로딩 상태 UI**: 기존 차트 자리에 Skeleton 또는 "로딩 중..." 텍스트
5. **에러 상태**: 콘솔 경고만 찍고 props 폴백 데이터 사용 (graceful degradation)

6. **data 결정 로직**:
   ```typescript
   const effectiveDaily = bqDaily.length > 0 ? bqDaily : daily;
   const effectiveWeekly = bqWeekly.length > 0 ? bqWeekly : weekly;
   const data = tab === 'daily' ? effectiveDaily : effectiveWeekly;
   ```

**주의**: `CustomerTypeDonut`, `CustomerTypeTrend` 컴포넌트는 수정하지 않는다. 동일한 `CustomerTypeRow[]`를 전달하면 된다.
  </action>
  <verify>
    <automated>cd C:\Users\socar\googlesheet-dashboard && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>
    - CustomerTypeSection이 마운트 시 /api/customer-type를 fetch
    - BQ 데이터 로드 성공 시 BQ 데이터로 차트 렌더링
    - BQ 실패 시 기존 Sheets props 폴백 (graceful degradation)
    - 로딩 중 시각적 피드백 표시
    - TypeScript 컴파일 에러 없음
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: 고객 유형 분석 BQ 데이터 표시 확인</name>
  <files>none</files>
  <action>
사용자가 개발 서버에서 고객 유형 분석 차트가 BQ 데이터로 정상 표시되는지 직접 확인한다.

검증 항목:
1. `cd C:\Users\socar\googlesheet-dashboard && npm run dev`
2. http://localhost:3000/dashboard 접속 (로그인 필요 시 로그인)
3. "고객 유형 분석" 섹션 확인:
   - 도넛 차트: 왕복/배달/편도 비율이 표시되는지 (더 이상 "데이터 없음" 아닌지)
   - 추이 차트: stacked bar로 일별 건수가 표시되는지
4. "주차별" 탭 전환 시 주간 데이터도 정상 표시되는지
5. 브라우저 DevTools > Network에서 `/api/customer-type` 응답이 daily/weekly 배열을 포함하는지
  </action>
  <verify>
    <automated>echo "Human verification checkpoint — manual visual check required"</automated>
  </verify>
  <done>"approved" 또는 수정 필요 사항 기술</done>
</task>

</tasks>

<verification>
1. TypeScript 컴파일: `npx tsc --noEmit` 에러 없음
2. API 응답 확인: `curl http://localhost:3000/api/customer-type` (인증 후) — daily/weekly 배열 반환
3. 도넛 차트 + 추이 차트에 실제 BQ 데이터 표시
</verification>

<success_criteria>
- 고객 유형 분석 도넛 차트에 왕복/배달/편도 분포가 실 데이터로 표시됨
- 유형별 이용건수 추이 차트에 일별/주별 데이터가 stacked bar로 표시됨
- BQ 미설정 환경에서도 기존 Sheets 폴백으로 에러 없이 렌더링
</success_criteria>

<output>
After completion, create `.planning/quick/260417-glt-bq-reservation-v2-way-api/260417-glt-SUMMARY.md`
</output>
