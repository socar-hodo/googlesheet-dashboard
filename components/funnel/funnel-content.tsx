"use client";

import { useCallback, useEffect, useState } from "react";
import type { FunnelData } from "@/types/funnel";
import { FunnelHeader } from "./funnel-header";
import { KpiCards } from "./kpi-cards";
import { CvrTrendChart } from "./cvr-trend-chart";
import { RegionRanking } from "./region-ranking";
import { DetailTable } from "./detail-table";

async function fetchFunnelData(
  weeks: number,
  region1: string | null,
): Promise<FunnelData> {
  const url = region1
    ? `/api/funnel/detail?region1=${encodeURIComponent(region1)}&weeks=${weeks}`
    : `/api/funnel/weekly?weeks=${weeks}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function FunnelContent() {
  const [weeks, setWeeks] = useState(12);
  const [drillRegion, setDrillRegion] = useState<string | null>(null);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunnelData(weeks, drillRegion);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [weeks, drillRegion]);

  useEffect(() => {
    load();
  }, [load]);

  function handleRegionClick(region: string) {
    if (!drillRegion) {
      setDrillRegion(region);
    }
  }

  function handleBack() {
    setDrillRegion(null);
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="mt-2 text-sm text-blue-500 underline"
            onClick={load}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FunnelHeader
        weeks={weeks}
        onWeeksChange={setWeeks}
        drillRegion={drillRegion}
        onBack={handleBack}
        loading={loading}
      />

      {data && (
        <>
          <KpiCards summary={data.summary} />

          <CvrTrendChart data={data.trend} />

          <div className="grid gap-4 md:grid-cols-3">
            <RegionRanking
              data={data.ranking}
              onRegionClick={handleRegionClick}
            />
            <div className="md:col-span-2">
              <DetailTable
                data={data.ranking}
                canDrillDown={!drillRegion}
                onRegionClick={handleRegionClick}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
