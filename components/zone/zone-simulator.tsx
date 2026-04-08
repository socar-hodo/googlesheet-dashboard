"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ZoneModeTabs } from "./zone-mode-tabs";
import { ZoneSearch } from "./zone-search";
import { ZoneLegend } from "./zone-legend";
import { OpenPanel } from "./panels/open-panel";
import { ClosePanel } from "./panels/close-panel";
import { ComparePanel } from "./panels/compare-panel";
import { OptimizePanel } from "./panels/optimize-panel";
import type {
  ZoneMode,
  ZoneMapHandle,
  ZoneInfo,
  OpenSimResult,
  CloseSimResult,
  CompareResult,
  OptimizeResult,
} from "@/types/zone";

/* ── Dynamic import: Kakao Map (SSR 불가) ────────────────────── */
const ZoneMap = dynamic(() => import("./zone-map"), { ssr: false });

/**
 * Zone 시뮬레이터 메인 오케스트레이터.
 *
 * 좌 70% = 카카오맵 + 검색바 + 범례
 * 우 30% = 모드별 사이드 패널
 *
 * 상태 흐름:
 * 1. 모드 전환 → 맵 오버레이 초기화 + 패널 교체
 * 2. 맵 클릭 / 존 클릭 / 검색 → 해당 모드의 API 호출
 * 3. API 응답 → 결과 상태 업데이트 → 패널 + 맵 오버레이 동기화
 */
export function ZoneSimulator() {
  const mapRef = useRef<ZoneMapHandle | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── 공통 상태 ─────────────────────────────────────────────
  const [mode, setModeState] = useState<ZoneMode>(
    (searchParams.get("mode") as ZoneMode) || "open",
  );
  const [allZones, setAllZones] = useState<ZoneInfo[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);

  // ── 개설 모드 상태 ────────────────────────────────────────
  const [openCandidate, setOpenCandidate] = useState<{ lat: number; lng: number; addr: string } | null>(null);
  const [openResult, setOpenResult] = useState<OpenSimResult | null>(null);
  const [openLoading, setOpenLoading] = useState(false);

  // ── 폐쇄 모드 상태 ────────────────────────────────────────
  const [closeZoneId, setCloseZoneId] = useState<number | null>(null);
  const [closeResult, setCloseResult] = useState<CloseSimResult | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  // ── 비교 모드 상태 ────────────────────────────────────────
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // ── 최적화 모드 상태 ──────────────────────────────────────
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);
  const [optLoading, setOptLoading] = useState(false);

  // ── 존 목록 로드 (close/compare 모드에서 필요) ────────────
  const loadZones = useCallback(async () => {
    if (zonesLoaded) return allZones;
    try {
      const res = await fetch("/api/zone/zones");
      if (!res.ok) throw new Error(`zones fetch failed: ${res.status}`);
      const data = await res.json();
      const zones = Array.isArray(data) ? data : [];
      setAllZones(zones);
      setZonesLoaded(true);
      return zones;
    } catch (err) {
      console.error("zone/zones fetch error:", err);
      toast.error("존 목록을 불러올 수 없습니다.");
      return [];
    }
  }, [zonesLoaded, allZones]);

  // ── 모드 전환 ─────────────────────────────────────────────
  const handleModeChange = useCallback(
    async (newMode: ZoneMode) => {
      setModeState(newMode);
      router.replace(`/zone?mode=${newMode}`, { scroll: false });
      mapRef.current?.clearOverlays();

      // 모드별 초기화
      if (newMode === "open") {
        setOpenCandidate(null);
        setOpenResult(null);
      } else if (newMode === "close") {
        setCloseZoneId(null);
        setCloseResult(null);
        const zones = await loadZones();
        // 전체 존 마커 표시
        zones.forEach((z: ZoneInfo) => {
          if (z.lat != null && z.lng != null) {
            mapRef.current?.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
          }
        });
      } else if (newMode === "compare") {
        setCompareIds([]);
        setCompareResult(null);
        const zones = await loadZones();
        zones.forEach((z: ZoneInfo) => {
          if (z.lat != null && z.lng != null) {
            mapRef.current?.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
          }
        });
      } else if (newMode === "optimize") {
        setOptResult(null);
      }
    },
    [loadZones],
  );

  // ── 개설 시뮬레이션 실행 ──────────────────────────────────
  const runOpenSim = useCallback(async (lat: number, lng: number, alpha = 0.5, addr = "") => {
    setOpenCandidate({ lat, lng, addr });
    setOpenLoading(true);
    try {
      const res = await fetch("/api/zone/simulate/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radius_m: 1000, alpha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서버 오류");
      setOpenResult(data);
    } catch (err) {
      toast.error("개설 분석 중 오류가 발생했습니다.");
      console.error("simulate/open error", err);
    } finally {
      setOpenLoading(false);
    }
  }, []);

  // ── 폐쇄 시뮬레이션 실행 ──────────────────────────────────
  const runCloseSim = useCallback(async (zoneId: number) => {
    setCloseZoneId(zoneId);
    setCloseLoading(true);
    try {
      const res = await fetch("/api/zone/simulate/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서버 오류");
      setCloseResult(data);
    } catch (err) {
      toast.error("폐쇄 분석 중 오류가 발생했습니다.");
      console.error("simulate/close error", err);
    } finally {
      setCloseLoading(false);
    }
  }, []);

  // ── 비교 실행 ─────────────────────────────────────────────
  const runCompare = useCallback(async (ids: number[]) => {
    if (ids.length < 2) {
      setCompareResult(null);
      return;
    }
    setCompareLoading(true);
    try {
      const res = await fetch("/api/zone/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서버 오류");
      setCompareResult(data);
    } catch (err) {
      toast.error("비교 분석 중 오류가 발생했습니다.");
      console.error("compare error", err);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  // ── 최적화 실행 ───────────────────────────────────────────
  const runOptimize = useCallback(async (region1: string, region2?: string) => {
    setOptLoading(true);
    try {
      const body: Record<string, string> = { region1 };
      if (region2) body.region2 = region2;
      const res = await fetch("/api/zone/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서버 오류");
      setOptResult(data);
    } catch (err) {
      toast.error("최적화 분석 중 오류가 발생했습니다.");
      console.error("optimize error", err);
    } finally {
      setOptLoading(false);
    }
  }, []);

  // ── 맵 이벤트 핸들러 ──────────────────────────────────────
  const handleMapClick = useCallback(
    (lat: number, lng: number, addr: string | null) => {
      if (mode === "open") {
        runOpenSim(lat, lng, 0.5, addr ?? "");
      }
      // close, compare, optimize — 맵 빈 공간 클릭은 무시
    },
    [mode, runOpenSim],
  );

  const handleZoneClick = useCallback(
    (zoneId: number) => {
      if (mode === "close") {
        runCloseSim(zoneId);
      } else if (mode === "compare") {
        setCompareIds((prev) => {
          const idx = prev.indexOf(zoneId);
          let next: number[];
          if (idx === -1) {
            if (prev.length >= 5) {
              toast.warning("최대 5개까지 선택할 수 있습니다.");
              return prev;
            }
            next = [...prev, zoneId];
          } else {
            next = prev.filter((id) => id !== zoneId);
          }
          runCompare(next);
          return next;
        });
      }
    },
    [mode, runCloseSim, runCompare],
  );

  // ── 검색 결과 처리 ────────────────────────────────────────
  const handleSearch = useCallback(
    (lat: number, lng: number, addr: string) => {
      mapRef.current?.setCenter(lat, lng, 5);
      handleMapClick(lat, lng, addr);
    },
    [handleMapClick],
  );

  // ── 시나리오 저장 ─────────────────────────────────────────
  const saveScenario = useCallback(
    async (scenarioMode: ZoneMode, parameters: Record<string, unknown>, results: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/zone/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: scenarioMode, parameters, results }),
        });
        if (!res.ok) throw new Error();
        toast.success("시나리오가 저장되었습니다.");
      } catch {
        toast.error("시나리오 저장에 실패했습니다.");
      }
    },
    [],
  );

  // ── Slack 발송 ────────────────────────────────────────────
  const sendSlackReport = useCallback(
    async (reportMode: ZoneMode, data: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/zone/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: reportMode, data }),
        });
        if (!res.ok) throw new Error();
        toast.success("Slack으로 발송되었습니다.");
      } catch {
        toast.error("Slack 발송에 실패했습니다.");
      }
    },
    [],
  );

  // ── Alpha 변경 (개설 모드) ────────────────────────────────
  const handleAlphaChange = useCallback(
    (alpha: number) => {
      if (openCandidate) {
        runOpenSim(openCandidate.lat, openCandidate.lng, alpha, openCandidate.addr);
      }
    },
    [openCandidate, runOpenSim],
  );

  // ── 비교 존 제거 ──────────────────────────────────────────
  const handleRemoveCompareZone = useCallback(
    (zoneId: number) => {
      setCompareIds((prev) => {
        const next = prev.filter((id) => id !== zoneId);
        runCompare(next);
        return next;
      });
    },
    [runCompare],
  );

  return (
    <div className="flex gap-4" style={{ height: "calc(100dvh - 12rem)" }}>
      {/* ── 좌측: 지도 (70%) ──────────────────────────────── */}
      <div className="relative flex-[7] overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/90 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        {/* 검색바 (맵 위 상단) */}
        <div className="absolute left-3 right-3 top-3 z-10">
          <ZoneSearch onSearch={handleSearch} />
        </div>

        {/* 카카오맵 */}
        <ZoneMap
          ref={mapRef}
          onMapClick={handleMapClick}
          onZoneClick={handleZoneClick}
          className="h-full w-full"
        />

        {/* 범례 (맵 위 하단 좌측) */}
        <ZoneLegend mode={mode} />
      </div>

      {/* ── 우측: 사이드 패널 (30%) ──────────────────────── */}
      <div className="flex flex-[3] flex-col gap-4 overflow-hidden">
        {/* 모드 탭 */}
        <ZoneModeTabs activeMode={mode} onChange={handleModeChange} />

        {/* 스크롤 가능한 패널 영역 */}
        <div className="flex-1 overflow-y-auto pr-1">
          {mode === "open" && (
            <OpenPanel
              candidate={openCandidate}
              result={openResult}
              loading={openLoading}
              onAlphaChange={handleAlphaChange}
              onSave={() => {
                if (openCandidate && openResult) {
                  saveScenario("open", openCandidate, openResult as unknown as Record<string, unknown>);
                }
              }}
              onSlack={() => {
                if (openResult) {
                  sendSlackReport("open", openResult as unknown as Record<string, unknown>);
                }
              }}
              mapRef={mapRef}
            />
          )}

          {mode === "close" && (
            <ClosePanel
              selectedZoneId={closeZoneId}
              allZones={allZones}
              result={closeResult}
              loading={closeLoading}
              onSave={() => {
                if (closeZoneId && closeResult) {
                  saveScenario("close", { zone_id: closeZoneId }, closeResult as unknown as Record<string, unknown>);
                }
              }}
              onSlack={() => {
                if (closeResult) {
                  sendSlackReport("close", closeResult as unknown as Record<string, unknown>);
                }
              }}
              mapRef={mapRef}
            />
          )}

          {mode === "compare" && (
            <ComparePanel
              selectedZoneIds={compareIds}
              allZones={allZones}
              result={compareResult}
              loading={compareLoading}
              onRemoveZone={handleRemoveCompareZone}
              onSlack={() => {
                if (compareResult) {
                  sendSlackReport("compare", compareResult as unknown as Record<string, unknown>);
                }
              }}
              mapRef={mapRef}
            />
          )}

          {mode === "optimize" && (
            <OptimizePanel
              result={optResult}
              loading={optLoading}
              onRun={runOptimize}
              onSave={() => {
                if (optResult) {
                  saveScenario("optimize", {}, optResult as unknown as Record<string, unknown>);
                }
              }}
              onSlack={() => {
                if (optResult) {
                  sendSlackReport("optimize", optResult as unknown as Record<string, unknown>);
                }
              }}
              mapRef={mapRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}
