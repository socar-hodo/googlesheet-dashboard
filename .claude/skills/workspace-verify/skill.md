---
name: workspace-verify
description: "워크스페이스 UI 구현을 설계 명세와 대조 검증한다. 빌드 성공, 타입 안전성, 반응형, 다크모드, 접근성, 명세 준수를 확인하고 심각도별 이슈를 보고한다."
---

# Workspace UI Verification

구현 결과를 설계 명세와 대조하여 품질을 검증하는 스킬.

## 검증 체크리스트

### 1. 빌드 검증 (Critical)
```bash
cd {project_root}
npm run build
```
- 빌드 성공/실패 여부
- 에러/경고 메시지 전문 기록

### 2. 타입 안전성 (Critical)
- 새로 추가된 props 인터페이스가 올바른지
- 기존 타입과 충돌 없는지
- any 타입 사용 여부

### 3. 명세 준수 (Major)
`_workspace/01_ui_audit_spec.md`의 각 개선 항목에 대해:
- 해당 파일에서 변경 사항을 코드로 확인
- PASS: 명세대로 구현됨
- PARTIAL: 일부만 구현됨 (누락 사항 명시)
- FAIL: 미구현 또는 잘못 구현

### 4. 반응형 검증 (Major)
- Tailwind 브레이크포인트 클래스 사용 확인 (코드 grep)
- 그리드/플렉스 레이아웃이 모바일에서 깨지지 않는 구조인지

### 5. 다크모드 검증 (Minor)
- 하드코딩된 색상값 없는지 (oklch CSS 변수 사용)
- dark: 접두사 또는 CSS 변수 자동 전환

### 6. 접근성 검증 (Minor)
- 인터랙티브 요소에 aria-label/role 존재
- 키보드 탐색 가능 여부 (tabIndex, onKeyDown)

## 보고서 형식

`_workspace/03_qa_report.md`:

```markdown
# QA 검증 보고서

## 빌드 결과
- npm run build: PASS / FAIL
- 에러: (있는 경우)

## 명세 준수 체크리스트
| # | 개선 항목 | 판정 | 비고 |
|---|---------|------|------|

## 이슈 목록
| # | 심각도 | 파일 | 설명 |
|---|--------|------|------|

## 종합 판정
- PASS: 모든 Critical 통과 + Major 80% 이상 통과
- CONDITIONAL: Critical 통과 + Major 일부 미통과
- FAIL: Critical 미통과
```

## 경계면 교차 비교 포인트

- props 인터페이스 ↔ 실제 전달되는 props
- CSS 변수 정의(`globals.css`) ↔ 사용처
- import 경로 ↔ 실제 파일 존재 여부
- 컴포넌트 분리 시 상태 흐름 ↔ 이벤트 핸들러 연결
