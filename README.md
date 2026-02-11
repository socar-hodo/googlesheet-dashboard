# Google Sheets Dashboard Starter Kit

Google Sheets를 데이터소스로 사용하는 모던 웹 대시보드 스타터킷입니다.

Looker Studio나 Google Data Studio의 **코드 기반 대안**으로, Google Sheets에 데이터를 입력하면 자동으로 대시보드에 반영됩니다. 디자인과 기능을 자유롭게 커스터마이징할 수 있습니다.

## 주요 기능

- **Google Sheets → 대시보드**: 스프레드시트 데이터를 실시간으로 시각화
- **Google 로그인 + 이메일 화이트리스트**: 허용된 사용자만 접근 가능
- **다크 모드**: 시스템 설정 연동 + 수동 토글
- **반응형 레이아웃**: 데스크톱/태블릿/모바일 대응
- **Mock 데이터 폴백**: Google Sheets 없이도 즉시 개발 가능

### 샘플 대시보드 구성

| 컴포넌트 | 설명 |
|---------|------|
| KPI 카드 4개 | 총 매출, 주문 수, 평균 주문 금액, 성장률 |
| 라인 차트 | 월별 매출 추이 (Recharts) |
| 파이 차트 | 카테고리별 비중 (Recharts) |
| 테이블 | 최근 주문 목록 (상태 배지 포함) |

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript 5, React 19 |
| 스타일링 | Tailwind CSS v4, shadcn/ui |
| 차트 | Recharts 3 |
| 아이콘 | Lucide React |
| 인증 | NextAuth.js v5 (Google OAuth) |
| 데이터 | Google Sheets API v4 (서비스 계정) |
| 다크 모드 | next-themes |

## 빠른 시작

### 1. 클론 및 설치

```bash
git clone https://github.com/citizendev9c/googlesheet-dashboard-starterkit.git
cd googlesheet-dashboard-starterkit
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열고 아래 값을 입력합니다:

```env
# 필수: 세션 암호화 키 (아래 명령어로 생성)
# openssl rand -base64 32
AUTH_SECRET=생성된_키

# Google OAuth (없으면 개발 모드 로그인으로 자동 전환)
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret

# 접근 허용 이메일 (비어있으면 모든 Google 계정 허용)
ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com

# Google Sheets 연동 (없으면 mock 데이터 사용)
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000` 에 접속하면 대시보드를 확인할 수 있습니다.

> Google OAuth 키가 없으면 **개발 모드**로 동작합니다. 이메일만 입력하면 바로 로그인됩니다.

## Google OAuth 발급 가이드

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (또는 새로 생성)
3. **API 및 서비스** → **사용자 인증 정보** 이동
4. **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID** 선택
5. 애플리케이션 유형: **웹 애플리케이션**
6. 승인된 리디렉션 URI 추가:
   - 개발: `http://localhost:3000/api/auth/callback/google`
   - 프로덕션: `https://your-domain.com/api/auth/callback/google`
7. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 `.env.local`에 입력

> OAuth 동의 화면 설정이 필요할 수 있습니다. **외부** 사용자 유형으로 설정하고, 앱 이름과 이메일만 입력하면 됩니다.

## 폴더 구조

```
├── app/
│   ├── (auth)/login/page.tsx         # 로그인 페이지
│   ├── (dashboard)/dashboard/page.tsx # 메인 대시보드
│   ├── api/auth/[...nextauth]/       # NextAuth API 핸들러
│   ├── layout.tsx                    # 루트 레이아웃 (프로바이더)
│   └── globals.css                   # Tailwind CSS v4 테마
├── components/
│   ├── dashboard/                    # 대시보드 위젯
│   │   ├── kpi-cards.tsx             #   KPI 카드 4개
│   │   ├── revenue-chart.tsx         #   매출 라인 차트
│   │   ├── category-chart.tsx        #   카테고리 파이 차트
│   │   └── recent-orders-table.tsx   #   최근 주문 테이블
│   ├── layout/                       # 레이아웃 컴포넌트
│   │   ├── sidebar.tsx               #   반응형 사이드바
│   │   ├── header.tsx                #   헤더 (아바타/로그아웃)
│   │   └── theme-toggle.tsx          #   다크모드 토글
│   ├── providers/                    # 클라이언트 프로바이더
│   └── ui/                           # shadcn/ui 컴포넌트
├── lib/
│   ├── data.ts                       # 데이터 통합 레이어
│   ├── sheets.ts                     # Google Sheets API 유틸
│   ├── mock-data.ts                  # 목 데이터
│   └── utils.ts                      # cn() 유틸리티
├── types/dashboard.ts                # TypeScript 타입 정의
├── auth.ts                           # NextAuth v5 설정
├── proxy.ts                          # 라우트 보호 (인증 미들웨어)
└── .env.example                      # 환경변수 템플릿
```

## Google Sheets 연동

### 1. 서비스 계정 생성

1. [Google Cloud Console](https://console.cloud.google.com/) → **API 및 서비스** → **사용자 인증 정보**
2. **사용자 인증 정보 만들기** → **서비스 계정**
3. 서비스 계정 생성 후 → **키** 탭 → **키 추가** → **JSON** 다운로드
4. [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) 활성화

### 2. 스프레드시트 준비

대시보드가 읽을 시트 구조:

**KPI 시트** (범위: `KPI!A1:B5`)

| 지표 | 값 |
|------|------|
| 총매출 | 124500000 |
| 주문수 | 1847 |
| 평균주문금액 | 67400 |
| 성장률 | 12.5 |

**매출 시트** (범위: `매출!A1:B13`)

| 월 | 매출 |
|------|------|
| 1월 | 8500000 |
| 2월 | 9200000 |
| ... | ... |

**카테고리 시트** (범위: `카테고리!A1:C6`)

| 카테고리 | 비율 | 색상 |
|---------|------|------|
| 전자제품 | 35 | var(--chart-1) |
| 의류 | 25 | var(--chart-2) |
| ... | ... | ... |

**주문 시트** (범위: `주문!A1:F11`)

| 주문번호 | 고객명 | 상품 | 금액 | 상태 | 날짜 |
|---------|-------|------|------|------|------|
| ORD-001 | 김철수 | 무선 이어폰 | 189000 | 완료 | 2025-01-15 |
| ... | ... | ... | ... | ... | ... |

### 3. 스프레드시트 공유

스프레드시트 → **공유** → 서비스 계정 이메일 (`xxx@project.iam.gserviceaccount.com`)을 **뷰어**로 추가

### 4. 환경변수 설정

```env
GOOGLE_SHEETS_ID=스프레드시트_URL에서_/d/와_/edit_사이의_문자열
GOOGLE_SERVICE_ACCOUNT_EMAIL=서비스계정@프로젝트.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> `GOOGLE_PRIVATE_KEY`는 JSON 키 파일의 `private_key` 값을 그대로 붙여넣으세요. 줄바꿈은 `\n`으로 표기합니다.

### 5. 시트 범위 커스터마이징

`lib/data.ts`에서 시트 범위를 수정할 수 있습니다:

```typescript
const [kpiRows, revenueRows, categoryRows, orderRows] = await Promise.all([
  fetchSheetData("KPI!A1:B5"),       // ← 시트 이름과 범위 수정
  fetchSheetData("매출!A1:B13"),
  fetchSheetData("카테고리!A1:C6"),
  fetchSheetData("주문!A1:F11"),
]);
```

## 커스터마이징 포인트

| 파일 | 수정 내용 |
|------|----------|
| `lib/mock-data.ts` | 샘플 데이터 변경 |
| `types/dashboard.ts` | 데이터 구조 변경 시 타입 수정 |
| `lib/data.ts` | 시트 범위 및 파서 함수 수정 |
| `components/dashboard/` | 차트/카드/테이블 UI 변경 |
| `components/layout/sidebar.tsx` | 네비게이션 메뉴 항목 추가 |
| `app/globals.css` | 테마 색상 (CSS 변수) 변경 |

## 배포

Vercel에 배포하는 것을 권장합니다:

```bash
npm run build   # 빌드 확인
```

Vercel 대시보드에서 환경변수(`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`, Google Sheets 관련)를 설정하세요.

## 라이선스

MIT License

Copyright (c) 2025 시민개발자 구씨 (citizendev9c)

🎬 YouTube: [시민개발자 구씨](https://www.youtube.com/@citizendev9c)