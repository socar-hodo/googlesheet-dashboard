import { auth } from '@/auth';
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
    return Response.json(
      { error: 'Google 인증 세션이 없어 통합 검색을 사용할 수 없습니다.' },
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
      return Response.json(
        {
          error:
            error.status === 401
              ? 'Google 인증이 만료되어 통합 검색을 계속할 수 없습니다. 다시 로그인해 주세요.'
              : error.status === 403
                ? 'Google Sheets 또는 Drive 권한이 부족해 통합 검색을 불러오지 못했습니다.'
                : 'Google Sheets 통합 검색을 불러오지 못했습니다.',
          detail: error.detail,
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
