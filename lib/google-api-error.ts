export type GoogleApiIssue =
  | 'reconnect'
  | 'api-disabled'
  | 'permission-denied'
  | 'quota'
  | 'unknown';

export function classifyGoogleApiError(detail: string): GoogleApiIssue {
  const normalized = detail.toLowerCase();

  if (
    normalized.includes('insufficient authentication scopes') ||
    normalized.includes('access_token_scope_insufficient') ||
    normalized.includes('insufficientpermissions') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('login required') ||
    normalized.includes('autherror')
  ) {
    return 'reconnect';
  }

  if (
    normalized.includes('has not been used in project') ||
    normalized.includes('is disabled') ||
    normalized.includes('accessnotconfigured') ||
    normalized.includes('service_disabled') ||
    normalized.includes('api has not been used')
  ) {
    return 'api-disabled';
  }

  if (
    normalized.includes('quota exceeded') ||
    normalized.includes('rate limit exceeded') ||
    normalized.includes('userratelimitexceeded') ||
    normalized.includes('dailylimitexceeded')
  ) {
    return 'quota';
  }

  if (
    normalized.includes('the caller does not have permission') ||
    normalized.includes('permission denied') ||
    normalized.includes('forbidden')
  ) {
    return 'permission-denied';
  }

  return 'unknown';
}

export function buildGoogleApiMessage(issue: GoogleApiIssue, target: 'list' | 'search'): string {
  if (issue === 'reconnect') {
    return target === 'search'
      ? 'Google 세션 권한이 현재 연결과 맞지 않아 통합 검색을 불러오지 못했습니다. Google로 다시 로그인해 주세요.'
      : 'Google 세션 권한이 현재 연결과 맞지 않아 시트 목록을 불러오지 못했습니다. Google로 다시 로그인해 주세요.';
  }

  if (issue === 'api-disabled') {
    return target === 'search'
      ? 'Google Drive API 또는 Google Sheets API가 현재 OAuth 프로젝트에서 비활성화되어 통합 검색을 불러오지 못했습니다.'
      : 'Google Drive API가 현재 OAuth 프로젝트에서 비활성화되어 시트 목록을 불러오지 못했습니다.';
  }

  if (issue === 'quota') {
    return target === 'search'
      ? 'Google API 호출 한도에 걸려 통합 검색을 잠시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : 'Google API 호출 한도에 걸려 시트 목록을 잠시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (issue === 'permission-denied') {
    return target === 'search'
      ? 'Google Sheets 또는 Drive 접근 권한이 현재 OAuth 프로젝트 정책과 맞지 않아 통합 검색을 불러오지 못했습니다.'
      : 'Google Drive 접근 권한이 현재 OAuth 프로젝트 정책과 맞지 않아 시트 목록을 불러오지 못했습니다.';
  }

  return target === 'search'
    ? 'Google Sheets 통합 검색을 불러오지 못했습니다.'
    : 'Google Drive에서 시트 목록을 가져오지 못했습니다.';
}
