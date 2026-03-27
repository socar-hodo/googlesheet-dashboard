import { auth } from '@/auth';
import {
  isGoogleApiError,
  searchAcrossOwnedSpreadsheets,
} from '@/lib/google-spreadsheets-index';

export const dynamic = 'force-dynamic';

function needsGoogleReconnect(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes('insufficient authentication scopes') ||
    normalized.includes('access_token_scope_insufficient') ||
    normalized.includes('insufficientpermissions') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('login required')
  );
}

export async function GET(req: Request) {
  const session = await auth();
  const accessToken = session?.accessToken;
  const cacheKey = session?.user?.email ?? session?.user?.id ?? 'anonymous';

  if (!accessToken) {
    return Response.json(
      {
        error: 'Google 계정 연결이 없어 통합 검색을 사용할 수 없습니다. Google로 다시 로그인해 주세요.',
        requiresGoogleReconnect: true,
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim() ?? '';
  const refresh = searchParams.get('refresh') === '1';

  try {
    const result = await searchAcrossOwnedSpreadsheets({
      accessToken,
      cacheKey,
      query,
      refresh,
    });

    return Response.json(result);
  } catch (error) {
    if (isGoogleApiError(error)) {
      const reconnectRequired =
        error.status === 401 || (error.status === 403 && needsGoogleReconnect(error.detail));

      return Response.json(
        {
          error: reconnectRequired
            ? 'Google Sheets 통합 검색 권한이 현재 세션에 연결되지 않았습니다. Google로 다시 로그인해 권한을 다시 승인해 주세요.'
            : error.status === 403
              ? 'Google Sheets 또는 Drive 권한이 부족해 통합 검색을 불러오지 못했습니다.'
              : 'Google Sheets 통합 검색을 불러오지 못했습니다.',
          detail: error.detail,
          requiresGoogleReconnect: reconnectRequired,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        error: 'Google Sheets 통합 검색 인덱스를 만들지 못했습니다.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
