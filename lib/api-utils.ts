import { auth } from "@/auth";
import { type Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

type ApiHandler = (
  req: NextRequest,
  ctx: { session: Session },
) => Promise<NextResponse>;

export const BQ_ERROR_MSG =
  "데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.";

/**
 * API Route 래퍼 — 인증 체크 + 에러 핸들링을 한 번에 처리.
 *
 * Usage:
 *   export const POST = withAuth(async (req, { session }) => {
 *     const body = await req.json();
 *     // ... business logic ...
 *     return NextResponse.json(result);
 *   });
 */
export function withAuth(handler: ApiHandler) {
  return async (req: NextRequest) => {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }
    try {
      return await handler(req, { session });
    } catch (err) {
      console.error(`[${req.method} ${req.nextUrl.pathname}]`, err);
      return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
    }
  };
}
