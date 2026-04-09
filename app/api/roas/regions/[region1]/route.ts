import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runParameterizedQuery } from "@/lib/bigquery";
import { BQ_ERROR_MSG } from "@/lib/api-utils";

// Dynamic-segment routes receive { params } as the second argument from Next.js routing.
// withAuth wraps a (req, ctx) signature that cannot carry Next.js route params, so we
// apply the same auth + error pattern manually here.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ region1: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { region1 } = await params;

  try {
    const sql = `
      SELECT DISTINCT region2
      FROM \`socar-data.socar_biz_base.carzone_info_daily\`
      WHERE date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
        AND region1 = @region1
        AND region2 IS NOT NULL AND region2 != ''
      ORDER BY region2
    `;
    const rows = await runParameterizedQuery(sql, [
      { name: "region1", type: "STRING", value: region1 },
    ]);
    if (!rows) {
      return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
    }
    return NextResponse.json(rows.map((r) => String(r.region2 ?? "")));
  } catch (err) {
    console.error("[roas/regions/region1]", err);
    return NextResponse.json({ error: BQ_ERROR_MSG }, { status: 500 });
  }
}
