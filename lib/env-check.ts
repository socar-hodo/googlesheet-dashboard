/**
 * 필수 환경변수 검증 — 서버 시작 시 호출.
 * 누락된 변수가 있으면 명확한 에러 메시지를 console.warn으로 출력.
 */
export function checkRequiredEnv() {
  const required: Record<string, string> = {
    GOOGLE_APPLICATION_CREDENTIALS_B64: "BigQuery 인증 (base64 인코딩된 credentials JSON)",
    AUTH_SECRET: "NextAuth.js 세션 서명 키",
  };

  const optional: Record<string, string> = {
    UPSTASH_REDIS_REST_URL: "Upstash Redis (시나리오 저장, 워크스페이스)",
    UPSTASH_REDIS_REST_TOKEN: "Upstash Redis 인증 토큰",
    NEXT_PUBLIC_KAKAO_JS_KEY: "카카오맵 SDK (존 시뮬레이터)",
    SLACK_WEBHOOK_URL: "Slack 리포트 발송",
  };

  const missing: string[] = [];
  for (const [key, desc] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`  ❌ ${key} — ${desc}`);
    }
  }

  const warnings: string[] = [];
  for (const [key, desc] of Object.entries(optional)) {
    if (!process.env[key]) {
      warnings.push(`  ⚠️ ${key} — ${desc}`);
    }
  }

  if (missing.length > 0) {
    console.error(`\n[호도 대시보드] 필수 환경변수 누락:\n${missing.join("\n")}\n`);
  }
  if (warnings.length > 0) {
    console.warn(`\n[호도 대시보드] 선택 환경변수 미설정 (일부 기능 비활성):\n${warnings.join("\n")}\n`);
  }
}
