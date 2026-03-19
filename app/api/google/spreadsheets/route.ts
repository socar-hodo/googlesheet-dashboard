import { auth } from '@/auth';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';

export const dynamic = 'force-dynamic';

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function GET(req: Request) {
  const session = await auth();
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return Response.json(
      { error: 'Google 인증 세션이 없어 개인 시트 검색을 사용할 수 없습니다.' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim() ?? '';

  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "'me' in owners",
    'trashed=false',
  ];

  if (query) {
    qParts.push(`name contains '${escapeDriveQuery(query)}'`);
  }

  const driveUrl = new URL('https://www.googleapis.com/drive/v3/files');
  driveUrl.searchParams.set('q', qParts.join(' and '));
  driveUrl.searchParams.set('pageSize', '50');
  driveUrl.searchParams.set('orderBy', 'modifiedTime desc');
  driveUrl.searchParams.set(
    'fields',
    'files(id,name,createdTime,modifiedTime,webViewLink,owners(displayName,emailAddress))',
  );
  driveUrl.searchParams.set('supportsAllDrives', 'false');

  const response = await fetch(driveUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: 'Google Drive에서 시트 목록을 가져오지 못했습니다.', detail },
      { status: response.status },
    );
  }

  const data = (await response.json()) as { files?: GoogleSpreadsheetFile[] };

  return Response.json({
    files: data.files ?? [],
  });
}
