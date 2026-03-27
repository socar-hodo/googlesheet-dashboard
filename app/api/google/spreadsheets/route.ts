import { auth } from '@/auth';
import type { GoogleSpreadsheetFile } from '@/types/google-drive';

export const dynamic = 'force-dynamic';

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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

  if (!accessToken) {
    return Response.json(
      {
        error: 'Google 계정 연결이 없어 시트 목록을 불러올 수 없습니다. Google로 다시 로그인해 주세요.',
        requiresGoogleReconnect: true,
      },
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
    const reconnectRequired =
      response.status === 401 || (response.status === 403 && needsGoogleReconnect(detail));

    return Response.json(
      {
        error: reconnectRequired
          ? 'Google Sheets 목록 권한이 현재 세션에 연결되지 않았습니다. Google로 다시 로그인해 권한을 다시 승인해 주세요.'
          : 'Google Drive에서 시트 목록을 가져오지 못했습니다.',
        detail,
        requiresGoogleReconnect: reconnectRequired,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as { files?: GoogleSpreadsheetFile[] };

  return Response.json({
    files: data.files ?? [],
  });
}
