---
name: workspace-implement
description: "UI 감사 명세를 받아 Next.js 16 + shadcn/ui + Tailwind v4 코드로 구현한다. 워크스페이스 포탈의 레이아웃, 반응형, 컴포넌트 구조, 디자인을 개선한다."
---

# Workspace UI Implementation

UI 감사 명세를 기반으로 워크스페이스 포탈의 UI/UX를 실제 코드로 개선하는 스킬.

## 구현 워크플로우

### 1. 명세 검토
- `_workspace/01_ui_audit_spec.md` 읽기
- 우선순위별 구현 항목 파악
- 의존성 순서 결정 (예: 레이아웃 변경 → 컴포넌트 분리 → 스타일링)

### 2. 변경 전 기존 코드 이해
- 수정 대상 파일을 반드시 먼저 Read
- 기존 상태 관리 흐름과 이벤트 핸들러 파악
- import/export 의존성 확인

### 3. 구현 규칙

**컴포넌트 분리:**
- 2000줄 이상 파일에서 논리적 섹션을 별도 컴포넌트로 추출
- 분리 시 props 인터페이스를 명확히 정의
- 상태(state)는 가능한 부모에 유지하고 props로 전달
- 분리된 컴포넌트는 `components/work-history/` 디렉토리에 배치

**Tailwind v4 스타일링:**
- 색상은 `app/globals.css`의 oklch CSS 변수 사용
- 다크모드는 CSS 변수로 자동 전환 (별도 dark: 불필요한 경우)
- 반응형: `sm:`, `md:`, `lg:`, `xl:` 접두사 사용
- 차트 색상: `var(--chart-1)` ~ `var(--chart-5)`

**shadcn/ui 활용:**
- Card, Tabs, Badge, Separator, ScrollArea 등 적극 활용
- 새 컴포넌트 필요 시 `npx shadcn@latest add {component}` 실행
- 설치 후 `components/ui/{component}.tsx` 생성 확인

**TypeScript:**
- 새 타입은 `types/` 디렉토리의 기존 파일에 추가
- props 인터페이스는 컴포넌트 파일 상단에 정의

### 4. 구현 후 확인
- `npm run build` 실행하여 빌드 성공 확인
- TypeScript 에러 없음 확인
- 변경 내역을 `_workspace/02_implementation_log.md`에 기록

## 구현 로그 형식

```markdown
# 구현 로그

## 변경 파일 목록
| 파일 | 변경 유형 | 설명 |
|------|----------|------|

## 추가된 의존성
- (있는 경우)

## 개선 항목별 상태
| 항목 | 상태 | 비고 |
|------|------|------|
| 개선 1 | DONE / SKIPPED / PARTIAL | |

## 빌드 결과
- `npm run build`: PASS / FAIL

## 주의 사항
- (후속 작업 필요 사항)
```
