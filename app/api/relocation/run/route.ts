import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { callOptimize } from "@/lib/zone-simulator-client";
import {
  RELOCATION_DEFAULTS,
  type OptimizeMacroRequest,
} from "@/types/relocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest) => {
  // v1.4: URL에서 ?raw=1 감지
  const url = new URL(req.url);
  const isRawMode = url.searchParams.get("raw") === "1";

  let body: Partial<OptimizeMacroRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const payload: OptimizeMacroRequest = {
    mode: "macro",
    total_transfer: Number.isFinite(body.total_transfer)
      ? Number(body.total_transfer)
      : RELOCATION_DEFAULTS.total_transfer,
    max_pct_per_region: Number.isFinite(body.max_pct_per_region)
      ? Number(body.max_pct_per_region)
      : RELOCATION_DEFAULTS.max_pct_per_region,
    min_cars_per_region: Number.isFinite(body.min_cars_per_region)
      ? Number(body.min_cars_per_region)
      : RELOCATION_DEFAULTS.min_cars_per_region,
    top_n: Number.isFinite(body.top_n)
      ? Number(body.top_n)
      : RELOCATION_DEFAULTS.top_n,
    // v1.4: raw 모드면 v1.3 낙관 (alpha_scale=1.0, churn=0) 복원
    alpha_scale: isRawMode
      ? 1.0
      : Number.isFinite(body.alpha_scale)
        ? Number(body.alpha_scale)
        : RELOCATION_DEFAULTS.alpha_scale,
    churn_penalty: isRawMode
      ? 0.0
      : Number.isFinite(body.churn_penalty)
        ? Number(body.churn_penalty)
        : RELOCATION_DEFAULTS.churn_penalty,
    exclude_regions: Array.isArray(body.exclude_regions) ? body.exclude_regions : [],
  };

  if (payload.total_transfer < 0 || payload.total_transfer > 10000) {
    return NextResponse.json({ error: "total_transfer는 0-10000 범위여야 합니다." }, { status: 422 });
  }
  if (payload.max_pct_per_region <= 0 || payload.max_pct_per_region > 1) {
    return NextResponse.json({ error: "max_pct_per_region는 0-1 범위여야 합니다." }, { status: 422 });
  }
  if (payload.min_cars_per_region < 0) {
    return NextResponse.json({ error: "min_cars_per_region는 0 이상이어야 합니다." }, { status: 422 });
  }
  if (payload.top_n < 1 || payload.top_n > 200) {
    return NextResponse.json({ error: "top_n은 1-200 범위여야 합니다." }, { status: 422 });
  }
  // v1.4
  if (payload.alpha_scale < 0.1 || payload.alpha_scale > 1.5) {
    return NextResponse.json({ error: "alpha_scale는 0.1-1.5 범위여야 합니다." }, { status: 422 });
  }
  if (payload.churn_penalty < 0 || payload.churn_penalty > 0.5) {
    return NextResponse.json({ error: "churn_penalty는 0-0.5 범위여야 합니다." }, { status: 422 });
  }

  try {
    const data = await callOptimize(payload);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/relocation/run] upstream error:", msg);
    return NextResponse.json(
      { error: "backend 오류", detail: msg.slice(0, 200) },
      { status: 502 }
    );
  }
});
