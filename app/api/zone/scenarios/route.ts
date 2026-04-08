import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { ScenarioSaveParams, ZoneScenario } from "@/types/zone";

// ── Redis client (lazy singleton) ─────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[zone/scenarios] UPSTASH_REDIS not configured");
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ── Key helpers ───────────────────────────────────────────────
const PREFIX = "zone:scenario";

function scenarioKey(id: string): string {
  return `${PREFIX}:${id}`;
}

function indexKey(): string {
  return `${PREFIX}:index`;
}

// ── TTL: 90 days ──────────────────────────────────────────────
const TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * POST /api/zone/scenarios — 시나리오 저장
 * Body: { mode, parameters, results }
 */
export async function POST(req: NextRequest) {
  try {
    const body: ScenarioSaveParams = await req.json();
    const { mode, parameters, results } = body;

    if (!mode) {
      return NextResponse.json(
        { error: "mode는 필수입니다." },
        { status: 400 },
      );
    }

    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { error: "시나리오 저장소가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const scenario: ZoneScenario = { id, mode, parameters, results, created_at: createdAt };

    // 시나리오 저장 (90일 TTL)
    await redis.set(scenarioKey(id), scenario, { ex: TTL_SECONDS });

    // 인덱스에 추가 (최근 100개까지)
    await redis.lpush(indexKey(), id);
    await redis.ltrim(indexKey(), 0, 99);

    return NextResponse.json({ id, created_at: createdAt });
  } catch (err) {
    console.error("[zone/scenarios] save error:", err);
    return NextResponse.json(
      { error: "시나리오 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/zone/scenarios — 시나리오 목록
 */
export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json([]);
    }

    // 인덱스에서 ID 목록 조회
    const ids: string[] = await redis.lrange(indexKey(), 0, 49);
    if (ids.length === 0) return NextResponse.json([]);

    // 각 시나리오 조회
    const scenarios: Array<{
      id: string;
      mode: string;
      created_at: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const id of ids) {
      const s = await redis.get<ZoneScenario>(scenarioKey(id));
      if (s) {
        scenarios.push({
          id: s.id,
          mode: s.mode,
          created_at: s.created_at,
          parameters: s.parameters,
        });
      }
    }

    return NextResponse.json(scenarios);
  } catch (err) {
    console.error("[zone/scenarios] list error:", err);
    return NextResponse.json(
      { error: "시나리오 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
