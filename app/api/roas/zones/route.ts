import { NextRequest, NextResponse } from "next/server";
import { runParameterizedQuery } from "@/lib/bigquery";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const region1 = sp.get("region1");
  // 프론트엔드에서 "A,B,C" 형태로 보내므로 split 처리
  const region2Raw = sp.get("region2") || "";
  const region2 = region2Raw.split(",").map(s => s.trim()).filter(Boolean);

  if (!region1 || region2.length === 0) {
    return NextResponse.json(
      { error: "region1 and region2 are required" },
      { status: 400 },
    );
  }

  const sql = `
    SELECT DISTINCT z.id, z.name, z.address
    FROM \`socar-data.socar_biz_base.carzone_info_daily\` z
    WHERE z.date = DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
      AND z.region1 = @region1
      AND z.region2 IN UNNEST(@region2_list)
      AND z.state = 1
      AND EXISTS (
        SELECT 1 FROM \`socar-data.socar_biz_base.car_info_daily\` c
        WHERE c.date = z.date AND c.zone_id = z.id
          AND c.sharing_type IN ('socar', 'zplus')
      )
    ORDER BY z.name
  `;
  const rows = await runParameterizedQuery(sql, [
    { name: "region1", type: "STRING", value: region1 },
    { name: "region2_list", type: "STRING", values: region2 },
  ]);
  if (!rows) {
    return NextResponse.json({ error: "BigQuery not configured" }, { status: 500 });
  }
  return NextResponse.json(
    rows.map((r) => ({
      id: Number(r.id ?? 0),
      name: String(r.name ?? ""),
      address: String(r.address ?? ""),
    })),
  );
});
