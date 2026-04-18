import type { OptimizeMacroRequest, OptimizeMacroResponse } from "@/types/relocation";

type CachedCookie = { value: string; expiresAt: number };
let cached: CachedCookie | null = null;

async function login(): Promise<string> {
  const base = process.env.ZONE_SIMULATOR_URL;
  const pw = process.env.ZONE_SIMULATOR_PASSWORD;
  if (!base || !pw) throw new Error("ZONE_SIMULATOR_URL/PASSWORD env missing");

  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: pw }),
    redirect: "manual",
  });

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie || ![200, 302, 303].includes(res.status)) {
    throw new Error(`zone-simulator login failed: ${res.status}`);
  }
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error("session cookie missing in set-cookie");

  const cookieValue = match[1];
  cached = { value: cookieValue, expiresAt: Date.now() + 7 * 3600 * 1000 };
  return cookieValue;
}

async function ensureCookie(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  return login();
}

export async function callOptimize(
  body: OptimizeMacroRequest
): Promise<OptimizeMacroResponse> {
  const base = process.env.ZONE_SIMULATOR_URL;
  if (!base) throw new Error("ZONE_SIMULATOR_URL env missing");
  let cookie = await ensureCookie();

  const doFetch = () =>
    fetch(`${base}/api/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${cookie}`,
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 401) {
    cached = null;
    cookie = await ensureCookie();
    res = await doFetch();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`zone-simulator /api/optimize ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as OptimizeMacroResponse;
}

// 테스트 전용 (vi.resetModules 대안)
export function __resetCacheForTest() {
  cached = null;
}
