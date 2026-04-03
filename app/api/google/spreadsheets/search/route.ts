import { auth } from '@/auth';
import { buildGoogleApiMessage, classifyGoogleApiError } from '@/lib/google-api-error';
import {
  isGoogleApiError,
  searchAcrossOwnedSpreadsheets,
} from '@/lib/google-spreadsheets-index';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  const accessToken = session?.accessToken;
  const cacheKey = session?.user?.email ?? session?.user?.id ?? 'anonymous';

  if (!accessToken) {
    const isGoogleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
    return Response.json(
      {
        error: isGoogleConfigured
          ? 'Google 계정 연결이 없어 통합 검색을 사용할 수 없습니다. Google로 다시 로그인해 주세요.'
          : 'Google OAuth가 설정되지 않아 통합 검색을 사용할 수 없습니다.',
        requiresGoogleReconnect: isGoogleConfigured,
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
      const issue = classifyGoogleApiError(error.detail);
      const reconnectRequired = error.status === 401 || issue === 'reconnect';

      console.error('[google-spreadsheets:search]', error.status, issue, error.detail);

      return Response.json(
        {
          error: buildGoogleApiMessage(issue, 'search'),
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
