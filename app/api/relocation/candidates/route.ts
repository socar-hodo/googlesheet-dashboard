import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";

const SAFE_ZONE = /^[가-힣a-zA-Z0-9\s]+$/;
const VALID_PAST_DAYS = [7, 14, 30];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const zones: string[] = Array.isArray(body.zones) ? body.zones : [];
  const limit: number = typeof body.limit === "number" && body.limit > 0 ? Math.ceil(body.limit) : 999;
  const pastDays: number = VALID_PAST_DAYS.includes(body.pastDays) ? body.pastDays : 14;

  if (zones.length === 0) {
    return NextResponse.json({ errors: ["zones 배열이 필요합니다."] }, { status: 400 });
  }

  const invalid = zones.filter((z) => !SAFE_ZONE.test(z));
  if (invalid.length > 0) {
    return NextResponse.json({ errors: ["허용되지 않는 zone명이 포함되어 있습니다."] }, { status: 400 });
  }

  const region2In = zones.map((z) => `'${z}'`).join(", ");

  // 해당 존 내 차량의 과거 N일 가동률 기준 오름차순 정렬
  // → 가동률이 낮은 차량이 재배치 시 더 효과적이므로 우선 추천
  const sql = `
    WITH car_perf AS (
      SELECT
        o.car_id,
        SAFE_DIVIDE(SUM(o.op_min), SUM(o.dp_min)) AS util_rate
      FROM \`socar-data.socar_biz.operation_per_car_daily_v2\` o
      WHERE o.date BETWEEN DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL ${pastDays} DAY)
                       AND DATE_SUB(CURRENT_DATE("Asia/Seoul"), INTERVAL 1 DAY)
        AND o.sharing_type IN ('socar', 'zplus')
      GROUP BY o.car_id
    )
    SELECT
      c.id       AS car_id,
      c.car_name,
      c.car_num,
      z.region1,
      z.region2,
      cp.util_rate
    FROM \`socar-data.socar_biz_base.car_info_daily\` c
    JOIN \`socar-data.socar_biz_base.carzone_info_daily\` z
      ON c.zone_id = z.id
     AND c.date    = z.date
    LEFT JOIN car_perf cp ON c.id = cp.car_id
    WHERE c.date = CURRENT_DATE("Asia/Seoul")
      AND c.sharing_type IN ('socar', 'zplus')
      AND c.imaginary = 0
      AND z.region2 IN (${region2In})
    ORDER BY cp.util_rate ASC NULLS LAST
    LIMIT ${limit}
  `;

  try {
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json(
        { errors: ["BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64)."] },
        { status: 400 }
      );
    }

    const candidates = rows.map((r) => ({
      carId:    Number(r.car_id   ?? 0),
      carName:  String(r.car_name ?? ""),
      carNum:   String(r.car_num  ?? ""),
      region1:  String(r.region1  ?? ""),
      region2:  String(r.region2  ?? ""),
      utilRate: r.util_rate != null ? Number(r.util_rate) : null,
    }));

    return NextResponse.json({ candidates });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ errors: [message] }, { status: 500 });
  }
}
