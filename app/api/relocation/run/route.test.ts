import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// withAuth를 identity-wrapper로 mock — authenticated session 주입
vi.mock("@/lib/api-utils", () => ({
  withAuth: (handler: (req: NextRequest, ctx: { session: unknown }) => Promise<NextResponse>) => {
    return async (req: NextRequest) =>
      handler(req, { session: { user: { email: "test@socar.kr" } } });
  },
}));
vi.mock("@/lib/zone-simulator-client", () => ({
  callOptimize: vi.fn(),
}));

import { POST } from "./route";
import { callOptimize } from "@/lib/zone-simulator-client";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/relocation/run", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(callOptimize).mockReset();
});

describe("POST /api/relocation/run", () => {
  it("total_transfer 범위 초과 시 422", async () => {
    const res = await POST(makeReq({ mode: "macro", total_transfer: 999999 }));
    expect(res.status).toBe(422);
  });

  it("정상 요청 → callOptimize 호출 + 200", async () => {
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro",
      params: {
        mode: "macro", total_transfer: 100,
        max_pct_per_region: 0.2, min_cars_per_region: 5, top_n: 10,
        alpha_scale: 0.7, churn_penalty: 0.05, exclude_regions: [],
      },
      summary: {
        actual_transfer: 100,
        delta_rev_yr: 0,
        by_cluster: {},
        total_cost_est: 0,
        net_gain_yr: 0,
      },
      suggestions: { increase: [], decrease: [] },
      move_orders: [],
    });
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100, top_n: 10 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("macro");
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "macro", total_transfer: 100, top_n: 10 })
    );
  });

  it("upstream 실패 시 502", async () => {
    vi.mocked(callOptimize).mockRejectedValue(new Error("upstream boom"));
    const res = await POST(makeReq({ mode: "macro", total_transfer: 100 }));
    expect(res.status).toBe(502);
  });

  it("기본 요청 시 alpha_scale=0.7, churn_penalty=0.05 forwarding", async () => {
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro", params: {} as never,
      summary: { actual_transfer: 0, delta_rev_yr: 0, by_cluster: {}, total_cost_est: 0, net_gain_yr: 0 },
      suggestions: { increase: [], decrease: [] }, move_orders: [],
    });
    await POST(makeReq({ mode: "macro", total_transfer: 100 }));
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({ alpha_scale: 0.7, churn_penalty: 0.05 })
    );
  });

  it("?raw=1 시 alpha_scale=1.0, churn_penalty=0 forwarding", async () => {
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro", params: {} as never,
      summary: { actual_transfer: 0, delta_rev_yr: 0, by_cluster: {}, total_cost_est: 0, net_gain_yr: 0 },
      suggestions: { increase: [], decrease: [] }, move_orders: [],
    });
    const req = new NextRequest("http://localhost:3000/api/relocation/run?raw=1", {
      method: "POST",
      body: JSON.stringify({ mode: "macro", total_transfer: 100 }),
      headers: { "content-type": "application/json" },
    });
    await POST(req);
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({ alpha_scale: 1.0, churn_penalty: 0.0 })
    );
  });

  it("exclude_regions body forwarding", async () => {
    vi.mocked(callOptimize).mockResolvedValue({
      mode: "macro", params: {} as never,
      summary: { actual_transfer: 0, delta_rev_yr: 0, by_cluster: {}, total_cost_est: 0, net_gain_yr: 0 },
      suggestions: { increase: [], decrease: [] }, move_orders: [],
    });
    await POST(makeReq({ mode: "macro", exclude_regions: ["서울특별시", "제주특별자치도"] }));
    expect(vi.mocked(callOptimize)).toHaveBeenCalledWith(
      expect.objectContaining({ exclude_regions: ["서울특별시", "제주특별자치도"] })
    );
  });
});
