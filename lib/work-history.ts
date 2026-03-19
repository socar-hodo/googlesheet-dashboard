import type { WorkCategory, WorkHistoryRecord, WorkStatus } from '@/types/work-history';

const WORK_HISTORY_HEADERS = {
  id: ['id', 'ID'],
  date: ['date', '날짜'],
  title: ['title', '업무명', '제목'],
  summary: ['summary', '요약'],
  category: ['category', '카테고리'],
  status: ['status', '상태'],
  owner: ['owner', '작성자', '담당자'],
  tags: ['tags', '태그'],
  project: ['project', '프로젝트'],
  outcome: ['outcome', '결과', '성과'],
  source: ['source', '출처', '링크'],
  pinned: ['pinned', 'important', '고정', '중요'],
} as const;

export const sampleWorkHistoryRecords: WorkHistoryRecord[] = [
  {
    id: 'wrk-001',
    date: '2026-03-18',
    title: '주간 운영 리포트 포맷 개편',
    summary: '지표 중심 리포트에서 액션 중심 요약 구조로 바꾸고 템플릿을 정리했다.',
    category: 'delivery',
    status: 'done',
    owner: '나',
    tags: ['리포트', '주간업무', '템플릿'],
    project: '운영 리포팅',
    outcome: '반복 작성 시간을 줄이고 팀 공유 속도를 높였다.',
    source: 'Notion / Weekly Report',
    pinned: true,
  },
  {
    id: 'wrk-002',
    date: '2026-03-17',
    title: 'CS 이슈 원인 분석 정리',
    summary: '최근 2주 CS 문의를 유형별로 묶어 원인과 재발 방지 액션을 문서화했다.',
    category: 'analysis',
    status: 'done',
    owner: '나',
    tags: ['CS', '원인분석', 'VOC'],
    project: '고객경험 개선',
    outcome: '우선 대응할 문제 3건을 바로 식별할 수 있게 됐다.',
    source: 'Sheets / VOC Log',
  },
  {
    id: 'wrk-003',
    date: '2026-03-16',
    title: '분기 업무 우선순위 워크숍',
    summary: '팀 목표와 리소스를 기준으로 분기 핵심 과제를 재정렬했다.',
    category: 'meeting',
    status: 'done',
    owner: '나',
    tags: ['워크숍', '우선순위', '분기계획'],
    project: 'Q2 Planning',
    outcome: '즉시 진행할 과제와 보류 과제를 명확히 분리했다.',
    source: 'Meeting Note / Q2 Kickoff',
    pinned: true,
  },
  {
    id: 'wrk-004',
    date: '2026-03-15',
    title: '업무 요청 Intake 자동화 초안 작성',
    summary: '반복적으로 들어오는 요청을 템플릿 기반으로 수집하는 자동화 흐름을 설계했다.',
    category: 'automation',
    status: 'in-progress',
    owner: '나',
    tags: ['자동화', '요청관리', '폼'],
    project: 'Ops Automation',
    outcome: '수작업 분류 단계를 줄일 수 있는 기반을 만들고 있다.',
    source: 'Automation Draft',
  },
  {
    id: 'wrk-005',
    date: '2026-03-14',
    title: '신규 대시보드 요구사항 정리',
    summary: '실무자가 바로 찾고 싶은 정보 기준으로 화면 구조와 필드를 정리했다.',
    category: 'planning',
    status: 'done',
    owner: '나',
    tags: ['대시보드', '요구사항', 'MVP'],
    project: 'History Portal',
    outcome: '개발 범위와 필수 검색 항목을 빠르게 합의할 수 있었다.',
    source: 'Planning Doc',
  },
  {
    id: 'wrk-006',
    date: '2026-03-13',
    title: '운영 정책 FAQ 갱신',
    summary: '반복 질문이 많았던 정책 문구를 최신 기준으로 정비했다.',
    category: 'improvement',
    status: 'done',
    owner: '나',
    tags: ['정책', 'FAQ', '운영개선'],
    project: 'Knowledge Base',
    outcome: '반복 문의 응답 시간을 줄였다.',
    source: 'FAQ Doc',
  },
  {
    id: 'wrk-007',
    date: '2026-03-12',
    title: '협업 병목 구간 인터뷰',
    summary: '유관부서와의 핸드오프 과정에서 어디서 지연이 발생하는지 인터뷰했다.',
    category: 'analysis',
    status: 'blocked',
    owner: '나',
    tags: ['인터뷰', '병목', '협업프로세스'],
    project: 'Process Mapping',
    outcome: '의사결정 지연 구간은 찾았지만 승인 체계 확인이 더 필요하다.',
    source: 'Interview Notes',
  },
  {
    id: 'wrk-008',
    date: '2026-03-11',
    title: '월간 회고 액션아이템 추적',
    summary: '지난 회고에서 나온 실행 항목을 담당자와 상태 기준으로 재정리했다.',
    category: 'meeting',
    status: 'in-progress',
    owner: '나',
    tags: ['회고', '액션아이템', '추적'],
    project: 'Team Retrospective',
    outcome: '누락되기 쉬운 후속 액션을 한 화면에서 확인할 수 있다.',
    source: 'Retrospective Note',
  },
];

export const workCategoryLabels: Record<WorkCategory, string> = {
  planning: '기획',
  meeting: '회의',
  analysis: '분석',
  delivery: '산출물',
  automation: '자동화',
  improvement: '개선',
};

export const workStatusLabels: Record<WorkStatus, string> = {
  done: '완료',
  'in-progress': '진행 중',
  blocked: '보류',
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (header) map.set(header, index);
  });
  return map;
}

function getColumnIndex(headerIndex: Map<string, number>, aliases: readonly string[]): number | undefined {
  return aliases
    .map((alias) => headerIndex.get(normalizeHeader(alias)))
    .find((value): value is number => value !== undefined);
}

function getCell(row: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return row[index]?.trim() ?? '';
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[#,|;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parsePinned(raw: string): boolean {
  return ['true', '1', 'y', 'yes', '고정', '중요'].includes(raw.trim().toLowerCase());
}

function parseCategory(raw: string): WorkCategory {
  const normalized = raw.trim().toLowerCase();
  const aliasMap: Record<string, WorkCategory> = {
    planning: 'planning',
    기획: 'planning',
    meeting: 'meeting',
    회의: 'meeting',
    analysis: 'analysis',
    분석: 'analysis',
    delivery: 'delivery',
    산출물: 'delivery',
    automation: 'automation',
    자동화: 'automation',
    improvement: 'improvement',
    개선: 'improvement',
  };

  return aliasMap[normalized] ?? 'planning';
}

function parseStatus(raw: string): WorkStatus {
  const normalized = raw.trim().toLowerCase();
  const aliasMap: Record<string, WorkStatus> = {
    done: 'done',
    완료: 'done',
    complete: 'done',
    completed: 'done',
    'in-progress': 'in-progress',
    inprogress: 'in-progress',
    progress: 'in-progress',
    '진행 중': 'in-progress',
    진행중: 'in-progress',
    blocked: 'blocked',
    hold: 'blocked',
    보류: 'blocked',
  };

  return aliasMap[normalized] ?? 'done';
}

export function parseWorkHistoryRows(rows: string[][]): WorkHistoryRecord[] {
  if (rows.length < 2) return [];

  const [headerRow, ...dataRows] = rows;
  const headerIndex = buildHeaderIndex(headerRow);

  const indexes = {
    id: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.id),
    date: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.date),
    title: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.title),
    summary: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.summary),
    category: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.category),
    status: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.status),
    owner: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.owner),
    tags: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.tags),
    project: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.project),
    outcome: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.outcome),
    source: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.source),
    pinned: getColumnIndex(headerIndex, WORK_HISTORY_HEADERS.pinned),
  };

  return dataRows
    .filter((row) => getCell(row, indexes.title) !== '')
    .map((row, index): WorkHistoryRecord => ({
      id: getCell(row, indexes.id) || `work-history-${index + 1}`,
      date: getCell(row, indexes.date),
      title: getCell(row, indexes.title),
      summary: getCell(row, indexes.summary),
      category: parseCategory(getCell(row, indexes.category)),
      status: parseStatus(getCell(row, indexes.status)),
      owner: getCell(row, indexes.owner) || '미지정',
      tags: parseTags(getCell(row, indexes.tags)),
      project: getCell(row, indexes.project) || '미분류 프로젝트',
      outcome: getCell(row, indexes.outcome),
      source: getCell(row, indexes.source),
      pinned: parsePinned(getCell(row, indexes.pinned)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
