---
name: workspace-ux-orchestrator
description: "워크스페이스 포탈의 UI/UX 개선을 조율하는 오케스트레이터. '워크스페이스 UI 개선', '워크스페이스 디자인', '워크스페이스 레이아웃', '포탈 UI', '워크스페이스 반응형' 요청 시 이 스킬을 사용한다. ui-auditor → frontend-dev → ui-qa 파이프라인을 순차 실행하여 설계-구현-검증 품질을 보장한다."
---

# Workspace UX Orchestrator

워크스페이스 포탈의 UI/UX 개선을 설계-구현-검증 파이프라인으로 조율한다.

## 실행 모드: 서브 에이전트

## 에이전트 구성

| 에이전트 | subagent_type | 역할 | 스킬 | 출력 |
|---------|--------------|------|------|------|
| ui-auditor | ui-auditor | UI 분석 + 개선 설계 | workspace-audit | `_workspace/01_ui_audit_spec.md` |
| frontend-dev | frontend-dev | 설계 기반 구현 | workspace-implement | 소스 수정 + `_workspace/02_implementation_log.md` |
| ui-qa | ui-qa | 구현 검증 | workspace-verify | `_workspace/03_qa_report.md` |

## 워크플로우

### Phase 1: 준비
1. 프로젝트 루트 확인 (`C:/Users/socar/googlesheet-dashboard/`)
2. `_workspace/` 디렉토리 생성
3. 사용자 요청에서 개선 방향 파악 (레이아웃, 반응형, 디자인, 전체)

### Phase 2: UI 감사 — ui-auditor

```
Agent(
  subagent_type: "ui-auditor",
  model: "opus",
  prompt: """
  프로젝트: C:/Users/socar/googlesheet-dashboard/
  
  workspace-audit 스킬(`C:/Users/socar/googlesheet-dashboard/.claude/skills/workspace-audit/skill.md`)을 읽고 따르라.
  
  워크스페이스 포탈의 UI/UX를 분석하고 개선 설계 명세를 작성하라.
  개선 방향: {사용자 요청 방향}
  
  출력: _workspace/01_ui_audit_spec.md
  """
)
```

완료 후: `_workspace/01_ui_audit_spec.md`를 Read하여 사용자에게 요약 보고.
사용자 확인 후 다음 Phase 진행.

### Phase 3: 구현 — frontend-dev

```
Agent(
  subagent_type: "frontend-dev",
  model: "opus",
  prompt: """
  프로젝트: C:/Users/socar/googlesheet-dashboard/
  
  workspace-implement 스킬(`C:/Users/socar/googlesheet-dashboard/.claude/skills/workspace-implement/skill.md`)을 읽고 따르라.
  
  _workspace/01_ui_audit_spec.md의 설계 명세를 기반으로 UI를 개선하라.
  구현 우선순위를 따르고, 변경 내역을 로그로 남겨라.
  
  입력: _workspace/01_ui_audit_spec.md
  출력: 소스 수정 + _workspace/02_implementation_log.md
  """
)
```

완료 후: 구현 로그를 Read하여 진행 상황 보고.

### Phase 4: 검증 — ui-qa

```
Agent(
  subagent_type: "ui-qa",
  model: "opus",
  prompt: """
  프로젝트: C:/Users/socar/googlesheet-dashboard/
  
  workspace-verify 스킬(`C:/Users/socar/googlesheet-dashboard/.claude/skills/workspace-verify/skill.md`)을 읽고 따르라.
  
  구현 결과를 설계 명세와 대조하여 검증하라.
  
  입력: _workspace/01_ui_audit_spec.md + _workspace/02_implementation_log.md
  출력: _workspace/03_qa_report.md
  """
)
```

### Phase 5: 피드백 루프 (조건부)
QA 보고서가 FAIL인 경우:
1. Critical 이슈를 frontend-dev에게 전달하여 수정
2. 수정 후 ui-qa 재실행
3. 최대 2회 반복

### Phase 6: 정리
1. `_workspace/` 보존 (감사 추적용)
2. 사용자에게 최종 결과 요약
3. 필요 시 커밋 제안

## 데이터 흐름

```
[오케스트레이터] → Agent(ui-auditor) → 01_ui_audit_spec.md
                                            ↓
[오케스트레이터] → (사용자 확인) → Agent(frontend-dev) → 소스 수정 + 02_implementation_log.md
                                                              ↓
[오케스트레이터] → Agent(ui-qa) → 03_qa_report.md
                                      ↓
                              [PASS → 완료 / FAIL → frontend-dev 재실행]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| ui-auditor 실패 | 오케스트레이터가 직접 주요 파일을 읽고 간략한 감사 수행 |
| frontend-dev 빌드 실패 | 에러 메시지와 함께 frontend-dev 재호출 (컨텍스트 포함) |
| ui-qa Critical 이슈 | frontend-dev에 이슈 내용 전달하여 수정 요청 |
| ui-qa Major 이슈만 | 사용자에게 보고 후 수동 수정 여부 확인 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "워크스페이스 UI 개선해줘"
2. Phase 1: _workspace/ 생성
3. Phase 2: ui-auditor가 2000줄 포탈 분석 → 개선 명세 10항목 생성
4. Phase 3: 사용자 확인 후 frontend-dev가 P1/P2 항목 구현
5. Phase 4: ui-qa가 빌드 성공 + 명세 80% 이상 PASS 확인
6. 결과: CONDITIONAL PASS, Minor 이슈 2건 보고

### 에러 흐름
1. Phase 3에서 frontend-dev가 빌드 실패
2. 오케스트레이터가 에러 메시지를 포함하여 frontend-dev 재호출
3. 2차 시도에서 빌드 성공
4. Phase 4 정상 진행
