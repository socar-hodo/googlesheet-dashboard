import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runQuery } from "@/lib/bigquery";

const SQL_PATH = resolve(process.cwd(), "sql/relocation-candidates.sql");
// region2 값은 BigQuery 조회 결과에서 오지만 추가 검증 적용
const SAFE_ZONE = /^[가-힣a-zA-Z0-9\s]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const zones: string[] = Array.isArray(body.zones) ? body.zones : [];

  if (zones.length === 0) {
    return NextResponse.json({ errors: ["zones 배열이 필요합니다."] }, { status: 400 });
  }

  const invalid = zones.filter((z) => !SAFE_ZONE.test(z));
  if (invalid.length > 0) {
    return NextResponse.json({ errors: ["허용되지 않는 zone명이 포함되어 있습니다."] }, { status: 400 });
  }

  const region2In = zones.map((z) => `'${z}'`).join(", ");
  const sql = readFileSync(SQL_PATH, "utf-8").replace("{region2_in}", region2In);

  try {
    const rows = await runQuery(sql);
    if (!rows) {
      return NextResponse.json(
        { errors: ["BigQuery가 설정되지 않았습니다 (GOOGLE_APPLICATION_CREDENTIALS_B64)."] },
        { status: 400 }
      );
    }

    const candidates = rows.map((r) => ({
      carId:   Number(r.car_id  ?? 0),
      carName: String(r.car_name ?? ""),
      carNum:  String(r.car_num  ?? ""),
      region1: String(r.region1  ?? ""),
      region2: String(r.region2  ?? ""),
    }));

    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json(
      { errors: [`차량 후보 조회 중 오류가 발생했습니다: ${String(e)}`] },
      { status: 500 }
    );
  }
}
