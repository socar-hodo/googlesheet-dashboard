// BigQuery 연동 유틸리티
// 사용자 OAuth 자격증명(GOOGLE_APPLICATION_CREDENTIALS_B64) 방식으로 쿼리를 실행합니다.
// lib/sheets.ts와 대칭 구조 — 동일한 3-레이어 패턴에서 사용합니다.
//
// 인증 설정:
//   gcloud auth application-default login
//   base64 -w 0 ~/.config/gcloud/application_default_credentials.json
//   → 출력값을 GOOGLE_APPLICATION_CREDENTIALS_B64 환경변수에 설정
import { BigQuery } from "@google-cloud/bigquery";
import type { Query } from "@google-cloud/bigquery";
import { UserRefreshClient } from "google-auth-library";

/** BigQuery 환경변수가 설정되었는지 확인 */
export function isBigQueryConfigured(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;
}

/** BigQuery 클라이언트 생성 (사용자 OAuth 자격증명 또는 ADC) */
function getBigQueryClient(): BigQuery {
  const credsB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_B64;

  if (credsB64) {
    const creds = JSON.parse(Buffer.from(credsB64, "base64").toString("utf-8"));
    // authorized_user 타입은 credentials 옵션에 직접 넘기면 Vercel 등 서버리스에서
    // 인증이 실패하므로 UserRefreshClient를 경유해야 합니다.
    const auth = new UserRefreshClient(
      creds.client_id,
      creds.client_secret,
      creds.refresh_token,
    );
    return new BigQuery({ projectId: "hodo-op-sim", authClient: auth });
  }

  // 로컬 ADC 폴백 (gcloud auth application-default login)
  return new BigQuery({ projectId: "hodo-op-sim" });
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

// ── Parameterized query support ───────────────────────────────────────────────

export interface QueryParam {
  name: string;
  type: "STRING" | "INT64" | "FLOAT64" | "BOOL" | "DATE";
  value: string | number | boolean;
}

export interface ArrayQueryParam {
  name: string;
  type: "STRING" | "INT64";
  values: (string | number)[];
}

/**
 * BigQuery 파라미터 바인딩 쿼리 실행.
 * SQL에서 @paramName 구문 사용 가능 — SQL injection 근본 방지.
 *
 * @example
 * const rows = await runParameterizedQuery(
 *   "SELECT * FROM t WHERE region1 = @region AND id IN UNNEST(@ids)",
 *   [
 *     { name: "region", type: "STRING", value: "경상남도" },
 *     { name: "ids", type: "INT64", values: [1, 2, 3] },
 *   ]
 * );
 */
export async function runParameterizedQuery(
  sql: string,
  params?: (QueryParam | ArrayQueryParam)[],
): Promise<Record<string, unknown>[] | null> {
  if (!isBigQueryConfigured()) return null;

  const client = getBigQueryClient();

  const queryParams: Record<string, unknown> = {};
  const paramTypes: Record<string, unknown> = {};

  if (params) {
    for (const p of params) {
      if ("values" in p) {
        // Array parameter — BQ SDK expects type as [elementType] for arrays
        queryParams[p.name] = p.values;
        paramTypes[p.name] = [p.type];
      } else {
        queryParams[p.name] = p.value;
        paramTypes[p.name] = p.type;
      }
    }
  }

  const options: Query = { query: sql };
  if (params && params.length > 0) {
    options.params = queryParams;
    options.types = paramTypes as Record<string, string | string[]>;
  }

  const [rows] = await client.query(options);
  return rows as Record<string, unknown>[];
}
