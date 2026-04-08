"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Zone } from "@/types/roas";

interface RegionSelectorProps {
  /** 선택된 존 ID 배열 (제어 컴포넌트) */
  selectedZoneIds: number[];
  /** 존 선택 변경 콜백 */
  onZoneChange: (zoneIds: number[]) => void;
  /** 선택된 region1/region2 값 (부모에 알림용) */
  onRegionChange?: (region1: string, region2: string[]) => void;
}

export function RoasRegionSelector({
  selectedZoneIds,
  onZoneChange,
  onRegionChange,
}: RegionSelectorProps) {
  // -- 상태 --
  const [regions, setRegions] = useState<string[]>([]);
  const [region1, setRegion1] = useState("");
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [selectedRegion2, setSelectedRegion2] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // -- region1 목록 로드 (마운트 시 1회) --
  useEffect(() => {
    fetch("/api/roas/regions")
      .then((r) => {
        if (!r.ok) throw new Error(`regions fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: string[]) => {
        if (Array.isArray(data)) setRegions(data);
      })
      .catch((err) => console.error("regions fetch error:", err));
  }, []);

  // -- region1 변경 → region2 로드 --
  useEffect(() => {
    if (!region1) {
      setSubRegions([]);
      setSelectedRegion2([]);
      setZones([]);
      return;
    }
    fetch(`/api/roas/regions/${encodeURIComponent(region1)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`sub-regions fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: string[]) => {
        if (Array.isArray(data)) {
          setSubRegions(data);
          setSelectedRegion2(data); // 기본: 전체 선택
        }
      })
      .catch((err) => console.error("sub-regions fetch error:", err));
  }, [region1]);

  // -- region 변경 알림 --
  useEffect(() => {
    onRegionChange?.(region1, selectedRegion2);
  }, [region1, selectedRegion2, onRegionChange]);

  // -- 존 검색 --
  const handleSearchZones = useCallback(async () => {
    if (!region1 || selectedRegion2.length === 0) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        region1,
        region2: selectedRegion2.join(","),
      });
      const resp = await fetch(`/api/roas/zones?${params}`);
      if (!resp.ok) throw new Error(`zones fetch failed: ${resp.status}`);
      const data: Zone[] = await resp.json();
      if (Array.isArray(data)) {
        setZones(data);
        // 기본: 전체 존 선택
        onZoneChange(data.map((z) => z.id));
      }
    } catch (err) {
      console.error("zones fetch error:", err);
      // error handled via toast in parent
    } finally {
      setLoading(false);
    }
  }, [region1, selectedRegion2, onZoneChange]);

  // -- region2 체크박스 토글 --
  const toggleRegion2 = (r2: string) => {
    setSelectedRegion2((prev) =>
      prev.includes(r2) ? prev.filter((x) => x !== r2) : [...prev, r2]
    );
  };

  const toggleAllRegion2 = () => {
    setSelectedRegion2((prev) =>
      prev.length === subRegions.length ? [] : [...subRegions]
    );
  };

  // -- 존 체크박스 토글 --
  const toggleZone = (id: number) => {
    onZoneChange(
      selectedZoneIds.includes(id)
        ? selectedZoneIds.filter((x) => x !== id)
        : [...selectedZoneIds, id]
    );
  };

  const toggleAllZones = () => {
    const filteredZones = getFilteredZones();
    const allSelected = filteredZones.every((z) =>
      selectedZoneIds.includes(z.id)
    );
    if (allSelected) {
      const filteredIds = new Set(filteredZones.map((z) => z.id));
      onZoneChange(selectedZoneIds.filter((id) => !filteredIds.has(id)));
    } else {
      const existing = new Set(selectedZoneIds);
      const merged = [...selectedZoneIds];
      for (const z of filteredZones) {
        if (!existing.has(z.id)) merged.push(z.id);
      }
      onZoneChange(merged);
    }
  };

  const getFilteredZones = () => {
    if (!zoneSearch.trim()) return zones;
    const q = zoneSearch.toLowerCase();
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.address.toLowerCase().includes(q) ||
        String(z.id).includes(q)
    );
  };

  const filteredZones = getFilteredZones();

  return (
    <Card className="border-border/60 bg-card/95 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.16)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">지역 / 존 선택</CardTitle>
        <p className="text-sm text-muted-foreground">
          시/도 → 시/군/구 → 존을 순서대로 선택합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* region1 select */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">시/도</label>
          <select
            value={region1}
            onChange={(e) => setRegion1(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
          >
            <option value="">-- 선택 --</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* region2 checkboxes */}
        {subRegions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                시/군/구 ({selectedRegion2.length}/{subRegions.length})
              </label>
              <button
                type="button"
                onClick={toggleAllRegion2}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedRegion2.length === subRegions.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 bg-background p-2 space-y-0.5">
              {subRegions.map((r2) => (
                <label key={r2} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRegion2.includes(r2)}
                    onChange={() => toggleRegion2(r2)}
                    className="rounded"
                  />
                  <span className="text-xs">{r2}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 존 검색 버튼 */}
        {subRegions.length > 0 && (
          <Button
            onClick={handleSearchZones}
            disabled={loading || selectedRegion2.length === 0}
            className="w-full"
            size="sm"
          >
            {loading ? "검색 중..." : "존 검색"}
          </Button>
        )}

        {/* 존 목록 */}
        {zones.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                존 ({selectedZoneIds.length}/{zones.length}개 선택)
              </label>
              <button
                type="button"
                onClick={toggleAllZones}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                전체 선택/해제
              </button>
            </div>
            <Input
              placeholder="존 이름/주소/ID 검색..."
              value={zoneSearch}
              onChange={(e) => setZoneSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-background p-2 space-y-0.5">
              {filteredZones.map((z) => (
                <label key={z.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedZoneIds.includes(z.id)}
                    onChange={() => toggleZone(z.id)}
                    className="rounded"
                  />
                  <span className="text-xs">
                    <span className="font-medium">{z.name}</span>
                    <span className="text-muted-foreground ml-1">({z.id})</span>
                  </span>
                </label>
              ))}
              {filteredZones.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {zoneSearch ? "검색 결과 없음" : "존이 없습니다"}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
