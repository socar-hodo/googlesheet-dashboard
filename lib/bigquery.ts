// BigQuery 연동 유틸리티
// 사용자 OAuth 자격증명(GOOGLE_APPLICATION_CREDENTIALS_B64) 방식으로 쿼리를 실행합니다.
// lib/sheets.ts와 대칭 구조 — 동일한 3-레이어 패턴에서 사용합니다.
//
// 인증 설정:
//   gcloud auth application-default login
//   base64 -w 0 ~/.config/gcloud/application_default_credentials.json
//   → 출력값을 GOOGLE_APPLICATION_CREDENTIALS_B64 환경변수에 설정
import { BigQuery, type BigQueryOptions } from "@google-cloud/bigquery";

/** BigQuery 환경변수가 설정되었는지 확인 */
export function isBigQueryConfigured(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;
}

/** BigQuery 클라이언트 생성 (사용자 OAuth 자격증명 또는 ADC) */
function getBigQueryClient(): BigQuery {
  const credsB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;

  if (credsB64) {
    const creds = JSON.parse(Buffer.from(credsB64, "base64").toString("utf-8"));
    const options: BigQueryOptions = {
      projectId: "socar-data",
      credentials: {
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
        type: "authorized_user",
      },
    };
    return new BigQuery(options);
  }

  // 로컬 ADC 폴백 (gcloud auth application-default login)
  return new BigQuery({ projectId: "socar-data" });
}

/**
 * BigQuery SQL을 실행하고 결과를 객체 배열로 반환합니다.
 *
 * @param sql - 실행할 SQL 쿼리
 * @returns 결과 행 배열 또는 null (환경변수 미설정 시)
 *
 * @example
 * const rows = await runQuery("SELECT region1, SUM(revenue) AS rev FROM ... GROUP BY 1");
 * // rows = [{ region1: "서울특별시", rev: 12345678 }, ...]
 */
export async function runQuery(
  sql: string
): Promise<Record<string, unknown>[] | null> {
  if (!isBigQueryConfigured()) return null;

  const client = getBigQueryClient();
  const [rows] = await client.query({ query: sql });
  return rows as Record<string, unknown>[];
}
