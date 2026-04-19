import { describe, it, expect, beforeEach, vi } from "vitest";
import type { OptimizeMacroRequest, OptimizeMacroResponse } from "@/types/relocation";

// module-scoped cache를 테스트마다 리셋하기 위해 동적 import
async function loadClient() {
  vi.resetModules();
  process.env.ZONE_SIMULATOR_URL = "https://fake-zone-sim";
  process.env.ZONE_SIMULATOR_PASSWORD = "pw";
  return await import("./zone-simulator-client");
}

const REQ: OptimizeMacroRequest = {
  mode: "macro",
  total_transfer: 100,
  max_pct_per_region: 0.2,
  min_cars_per_region: 5,
  top_n: 10,
  alpha_scale: 1.0,
  churn_penalty: 0.02,
  exclude_regions: [],
};

const FAKE_RES: OptimizeMacroResponse = {
  mode: "macro",
  params: REQ,
  summary: {
    actual_transfer: 100,
    delta_rev_yr: 1_000_000_000,
    by_cluster: {},
    total_cost_est: 10_000_000,
    net_gain_yr: 990_000_000,
  },
  suggestions: { increase: [], decrease: [] },
  move_orders: [],
};

function mockFetchSequence(responses: Array<Response | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

function loginRes() {
  return new Response(null, {
    status: 303,
    headers: { "set-cookie": "session=abc123; Path=/; HttpOnly" },
  });
}

function optimizeOk(body = FAKE_RES) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function optimize401() {
  return new Response("unauthorized", { status: 401 });
}

describe("zone-simulator-client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("첫 호출 시 login + optimize 순차 실행", async () => {
    const fetchMock = mockFetchSequence([loginRes(), optimizeOk()]);
    const { callOptimize } = await loadClient();
    const r = await callOptimize(REQ);
    expect(r.mode).toBe("macro");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/login");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/optimize");
  });

  it("쿠키 캐시 재사용 — 두 번째 호출엔 login 없음", async () => {
    const fetchMock = mockFetchSequence([loginRes(), optimizeOk(), optimizeOk()]);
    const { callOptimize } = await loadClient();
    await callOptimize(REQ);
    await callOptimize(REQ);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.endsWith("/login"))).toHaveLength(1);
    expect(urls.filter((u) => u.endsWith("/api/optimize"))).toHaveLength(2);
  });

  it("401 응답 시 자동 재로그인 1회 → 재시도 성공", async () => {
    const fetchMock = mockFetchSequence([
      loginRes(),      // 첫 로그인
      optimize401(),   // 401 → 재로그인 트리거
      loginRes(),      // 재로그인
      optimizeOk(),    // 재시도 성공
    ]);
    const { callOptimize } = await loadClient();
    const r = await callOptimize(REQ);
    expect(r.mode).toBe("macro");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
