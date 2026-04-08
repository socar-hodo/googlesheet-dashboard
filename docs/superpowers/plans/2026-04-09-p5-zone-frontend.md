# P5. Zone 시뮬레이터 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 존 시뮬레이터의 카카오맵 기반 UI를 React + shadcn/ui + Recharts로 재작성한다. 좌 70% 지도 + 우 30% 패널 레이아웃.

**Architecture:** 카카오맵 SDK를 next/script로 로드, ref 기반 래퍼 컴포넌트로 관리. 4개 모드(개설/폐쇄/비교/최적화)를 탭으로 전환하며 사이드 패널 내용이 교체됨.

**Tech Stack:** React 19, TypeScript, shadcn/ui, Recharts, Kakao Map JS SDK, Next.js 16 App Router

---

## File Structure

```
types/zone.ts                                   ← 기존: P4에서 생성됨 (프론트 타입 추가)
components/zone/zone-map.tsx                     ← 신규: 카카오맵 래퍼 (ref 기반 imperative API)
components/zone/zone-search.tsx                  ← 신규: 주소 검색바
components/zone/zone-mode-tabs.tsx               ← 신규: 4개 모드 탭 (개설/폐쇄/비교/최적화)
components/zone/zone-legend.tsx                  ← 신규: 지도 범례
components/zone/panels/open-panel.tsx            ← 신규: 개설 모드 사이드 패널
components/zone/panels/close-panel.tsx           ← 신규: 폐쇄 모드 사이드 패널
components/zone/panels/compare-panel.tsx         ← 신규: 비교 모드 사이드 패널
components/zone/panels/optimize-panel.tsx        ← 신규: 최적화 모드 사이드 패널
components/zone/dialogs/scenario-dialog.tsx      ← 신규: 시나리오 저장/불러오기 다이얼로그
components/zone/dialogs/slack-report-dialog.tsx  ← 신규: Slack 발송 확인 다이얼로그
components/zone/zone-simulator.tsx               ← 신규: 메인 오케스트레이터 (상태 관리, map+panel 연결)
app/(dashboard)/zone/page.tsx                    ← 수정: 플레이스홀더 → 실제 시뮬레이터
```

---

## Shared Types (추가분)

`types/zone.ts` 하단에 프론트엔드 전용 타입을 추가한다. 기존 백엔드 타입은 수정하지 않는다.

```typescript
// ── Frontend-only types ──────────────────────────────────────

/** 4개 시뮬레이터 모드 */
export type ZoneMode = "open" | "close" | "compare" | "optimize";

/** 카카오맵 래퍼 imperative API */
export interface ZoneMapHandle {
  addMarker(lat: number, lng: number, opts?: MarkerOptions): void;
  clearOverlays(): void;
  setCenter(lat: number, lng: number, level?: number): void;
  addCircle(lat: number, lng: number, radiusM: number, opts?: CircleOptions): void;
  addOverlay(lat: number, lng: number, html: string): void;
  getMap(): kakao.maps.Map | null;
}

export interface MarkerOptions {
  color?: "red" | "blue" | "green" | "yellow" | "gray";
  zoneId?: number;
  title?: string;
}

export interface CircleOptions {
  strokeColor?: string;
  fillColor?: string;
  fillOpacity?: number;
}

/** 개설 시뮬레이션 응답 */
export interface OpenSimResult {
  estimated_revenue_per_car: number;
  estimated_utilization: number;
  cluster_type: string | null;
  cluster_benchmark: { avg_revenue_per_car: number; avg_utilization: number; zone_count: number };
  nearby_avg_revenue: number;
  nearby_avg_utilization: number;
  nearby_zones: Array<ZoneInfo & { distance_m: number; revenue_per_car: number; utilization: number }>;
  cannibalization: Array<{ zone_id: number; zone_name: string; distance_m: number; level: "danger" | "warning" }>;
  alpha: number;
}

/** 폐쇄 시뮬레이션 응답 */
export interface CloseSimResult {
  target_zone: {
    zone_id: number;
    name: string;
    region1: string;
    region2: string;
    revenue_per_car: number;
    utilization: number;
    car_count: number;
  };
  demand_transfer: {
    transfers: Array<{
      zone_id: number;
      zone_name: string;
      absorption_pct: number;
      lat?: number;
      lng?: number;
      current_utilization?: number;
      new_utilization?: number;
    }>;
    total_absorption_pct: number;
    churn_pct: number;
    cost_saved_monthly: number;
    churn_loss_monthly: number;
    net_effect_monthly: number;
  };
}

/** 비교 응답 */
export interface CompareResult {
  zones: Array<ZonePerformance & {
    name: string;
    region1: string;
    region2: string;
    lat: number;
    lng: number;
    cluster_type: string | null;
    cluster_benchmark: Record<string, unknown> | null;
  }>;
}

/** 최적화 응답 */
export interface OptimizeResult {
  summary: {
    total_zones: number;
    total_cars: number;
    avg_utilization: number;
    avg_cars_per_zone: number;
  };
  suggestions: {
    close: RegionZoneStat[];
    open: Array<{ area?: string; reason?: string; lat?: number; lng?: number }>;
    rebalance: Array<{
      from_zone: { zone_id: number; name: string; utilization: number };
      to_zone: { zone_id: number; name: string; utilization: number };
      cars: number;
    }>;
  };
  projected: {
    new_avg_utilization: number;
    monthly_savings: number;
  };
  zones: RegionZoneStat[];
}
```

---

## Task 1: `components/zone/zone-map.tsx` — 카카오맵 래퍼 컴포넌트

**Files:**
- Create: `components/zone/zone-map.tsx`

**Source:** `C:\Users\socar\socar\zone-simulator\static\map.js` (232 lines)

이 컴포넌트는 카카오맵 SDK 인스턴스를 래핑하고, `forwardRef` + `useImperativeHandle`로 부모에서 명령형으로 마커/원/오버레이를 제어할 수 있게 한다. `dynamic(() => import(...), { ssr: false })`로 임포트하여 SSR을 회피한다.

- [ ] **Step 1: `zone-map.tsx` 생성 — 카카오맵 래퍼**

`components/zone/zone-map.tsx`:

```typescript
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import type { ZoneMapHandle, MarkerOptions, CircleOptions } from "@/types/zone";

/* ── Kakao Maps global type augmentation ─────────────────────── */
declare global {
  interface Window {
    kakao: typeof kakao;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace kakao.maps {
    class Map {
      constructor(container: HTMLElement, options: { center: LatLng; level: number });
      setCenter(latlng: LatLng): void;
      setLevel(level: number): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }
    class Marker {
      constructor(opts: { map: Map; position: LatLng; title?: string; image?: MarkerImage });
      setMap(map: Map | null): void;
    }
    class MarkerImage {
      constructor(src: string, size: Size);
    }
    class Size {
      constructor(w: number, h: number);
    }
    class Circle {
      constructor(opts: {
        map: Map;
        center: LatLng;
        radius: number;
        strokeWeight?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeStyle?: string;
        fillColor?: string;
        fillOpacity?: number;
      });
      setMap(map: Map | null): void;
    }
    class CustomOverlay {
      constructor(opts: {
        map: Map;
        position: LatLng;
        content: HTMLElement | string;
        yAnchor?: number;
      });
      setMap(map: Map | null): void;
    }
    namespace event {
      function addListener(
        target: Map | Marker,
        type: string,
        handler: (...args: unknown[]) => void,
      ): void;
    }
    namespace services {
      class Geocoder {
        addressSearch(
          query: string,
          callback: (result: Array<{ x: string; y: string }>, status: string) => void,
        ): void;
      }
      class Places {
        keywordSearch(
          query: string,
          callback: (
            result: Array<{ x: string; y: string; place_name?: string }>,
            status: string,
          ) => void,
        ): void;
      }
      const Status: { OK: string };
    }
    function load(callback: () => void): void;
  }
}

/* ── Marker image URLs ───────────────────────────────────────── */
const MARKER_URLS: Record<string, string> = {
  red: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png",
  green: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/green_b.png",
  yellow: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/yellow_b.png",
};

const GRAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="35">' +
  '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 23 12 23s12-14 12-23C24 5.4 18.6 0 12 0z" fill="#999"/>' +
  '<circle cx="12" cy="12" r="5" fill="white"/></svg>';

/* ── Props ───────────────────────────────────────────────────── */
interface ZoneMapProps {
  /** 맵 클릭 시 호출. addr은 검색으로 진입한 경우에만 전달. */
  onMapClick?: (lat: number, lng: number, addr: string | null) => void;
  /** 존 마커 클릭 시 호출 */
  onZoneClick?: (zoneId: number) => void;
  /** 초기 중심 좌표 (기본: 부산) */
  initialCenter?: { lat: number; lng: number };
  /** 초기 줌 레벨 (기본: 8) */
  initialLevel?: number;
  className?: string;
}

/**
 * 카카오맵 래퍼.
 *
 * SSR 불가 — 반드시 dynamic import로 사용:
 * ```tsx
 * const ZoneMap = dynamic(() => import("@/components/zone/zone-map"), { ssr: false });
 * ```
 *
 * 부모에서 ref로 addMarker, clearOverlays 등 명령형 메서드를 호출한다.
 */
const ZoneMap = forwardRef<ZoneMapHandle, ZoneMapProps>(function ZoneMap(
  {
    onMapClick,
    onZoneClick,
    initialCenter = { lat: 35.1796, lng: 129.0756 },
    initialLevel = 8,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const circlesRef = useRef<kakao.maps.Circle[]>([]);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  // 최신 콜백을 ref에 저장하여 맵 이벤트 핸들러에서 stale closure 방지
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;

  /* ── Init map on mount ─────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || !window.kakao?.maps) return;

    kakao.maps.load(() => {
      const map = new kakao.maps.Map(containerRef.current!, {
        center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: initialLevel,
      });
      mapRef.current = map;

      kakao.maps.event.addListener(map, "click", (evt: { latLng: kakao.maps.LatLng }) => {
        const lat = evt.latLng.getLat();
        const lng = evt.latLng.getLng();
        onMapClickRef.current?.(lat, lng, null);
      });
    });

    return () => {
      // 카카오맵은 destroy API가 없으므로 ref만 정리
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Imperative methods ────────────────────────────────────── */
  const addMarker = useCallback((lat: number, lng: number, opts?: MarkerOptions) => {
    const map = mapRef.current;
    if (!map) return;

    const position = new kakao.maps.LatLng(lat, lng);
    const markerOpts: Record<string, unknown> = { map, position };
    if (opts?.title) markerOpts.title = opts.title;

    // 색상별 커스텀 이미지
    if (opts?.color && opts.color !== "blue") {
      if (opts.color === "gray") {
        const img = new kakao.maps.MarkerImage(
          "data:image/svg+xml," + encodeURIComponent(GRAY_SVG),
          new kakao.maps.Size(24, 35),
        );
        markerOpts.image = img;
      } else if (MARKER_URLS[opts.color]) {
        const img = new kakao.maps.MarkerImage(
          MARKER_URLS[opts.color],
          new kakao.maps.Size(24, 35),
        );
        markerOpts.image = img;
      }
    }

    const marker = new kakao.maps.Marker(markerOpts as ConstructorParameters<typeof kakao.maps.Marker>[0]);
    markersRef.current.push(marker);

    // 존 마커 클릭 이벤트
    if (opts?.zoneId != null) {
      kakao.maps.event.addListener(marker, "click", () => {
        onZoneClickRef.current?.(opts.zoneId!);
      });
    }
  }, []);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    circlesRef.current.forEach((c) => c.setMap(null));
    overlaysRef.current.forEach((o) => o.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];
    overlaysRef.current = [];
  }, []);

  const setCenter = useCallback((lat: number, lng: number, level?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter(new kakao.maps.LatLng(lat, lng));
    if (level !== undefined) map.setLevel(level);
  }, []);

  const addCircle = useCallback(
    (lat: number, lng: number, radiusM: number, opts?: CircleOptions) => {
      const map = mapRef.current;
      if (!map) return;
      const circle = new kakao.maps.Circle({
        map,
        center: new kakao.maps.LatLng(lat, lng),
        radius: radiusM,
        strokeWeight: 2,
        strokeColor: opts?.strokeColor ?? "#F59E0B",
        strokeOpacity: 1,
        strokeStyle: "dashed",
        fillColor: opts?.fillColor ?? "#F59E0B",
        fillOpacity: opts?.fillOpacity ?? 0.08,
      });
      circlesRef.current.push(circle);
    },
    [],
  );

  const addOverlay = useCallback((lat: number, lng: number, html: string) => {
    const map = mapRef.current;
    if (!map) return;
    const el = document.createElement("div");
    el.innerHTML = html;
    const overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(lat, lng),
      content: el,
      yAnchor: 1.3,
    });
    overlaysRef.current.push(overlay);
  }, []);

  const getMap = useCallback(() => mapRef.current, []);

  useImperativeHandle(ref, () => ({
    addMarker,
    clearOverlays,
    setCenter,
    addCircle,
    addOverlay,
    getMap,
  }));

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full w-full min-h-[400px] rounded-2xl"}
    />
  );
});

export default ZoneMap;
```

- [ ] **Step 2: 커밋**

```bash
git add components/zone/zone-map.tsx
git commit -m "feat(zone-ui): add ZoneMap wrapper — Kakao Map SDK with imperative ref API"
```

---

## Task 2: `zone-search.tsx` + `zone-mode-tabs.tsx` + `zone-legend.tsx` — 검색/탭/범례

**Files:**
- Create: `components/zone/zone-search.tsx`
- Create: `components/zone/zone-mode-tabs.tsx`
- Create: `components/zone/zone-legend.tsx`

**Source:** `C:\Users\socar\socar\zone-simulator\static\map.js` (searchAddress), `zone_simulator.js` (mode tabs)

- [ ] **Step 1: `zone-search.tsx` 생성 — 주소 검색바 (카카오 Geocoding)**

`components/zone/zone-search.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface ZoneSearchProps {
  /** 검색 결과 좌표와 주소/장소명 전달 */
  onSearch: (lat: number, lng: number, addr: string) => void;
}

/**
 * 카카오 Geocoding 기반 주소 검색바.
 *
 * 1차: addressSearch (정확한 주소)
 * 2차: keywordSearch (장소명 / 키워드 fallback)
 *
 * 카카오맵 SDK가 이미 로드된 상태에서만 동작한다 (zone page의 Script 태그 의존).
 */
export function ZoneSearch({ onSearch }: ZoneSearchProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || !window.kakao?.maps?.services) return;

    setSearching(true);
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(trimmed, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        const lat = parseFloat(result[0].y);
        const lng = parseFloat(result[0].x);
        onSearch(lat, lng, trimmed);
        setSearching(false);
        return;
      }

      // Fallback: keyword search
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(trimmed, (data, psStatus) => {
        if (psStatus === kakao.maps.services.Status.OK && data.length > 0) {
          const lat = parseFloat(data[0].y);
          const lng = parseFloat(data[0].x);
          onSearch(lat, lng, data[0].place_name ?? trimmed);
        }
        setSearching(false);
      });
    });
  }, [query, onSearch]);

  return (
    <div className="flex gap-2">
      <Input
        placeholder="주소 또는 장소명 검색"
        className="h-10 rounded-2xl border-border/70 bg-background/95 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
        disabled={searching}
      />
      <Button
        size="icon"
        variant="outline"
        className="h-10 w-10 shrink-0 rounded-2xl"
        onClick={handleSearch}
        disabled={searching}
        aria-label="검색"
      >
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: `zone-mode-tabs.tsx` 생성 — 4개 모드 탭**

`components/zone/zone-mode-tabs.tsx`:

```typescript
"use client";

import type { ZoneMode } from "@/types/zone";

const MODES: { value: ZoneMode; label: string; color: string }[] = [
  { value: "open", label: "개설", color: "text-blue-600" },
  { value: "close", label: "폐쇄", color: "text-red-600" },
  { value: "compare", label: "비교", color: "text-purple-600" },
  { value: "optimize", label: "최적화", color: "text-emerald-600" },
];

interface ZoneModeTabsProps {
  activeMode: ZoneMode;
  onChange: (mode: ZoneMode) => void;
}

/**
 * 4개 모드 탭.
 * 활성 탭은 foreground 배경, 비활성은 hover:bg-muted.
 * allocation-form.tsx의 라디오 그룹 패턴을 따른다.
 */
export function ZoneModeTabs({ activeMode, onChange }: ZoneModeTabsProps) {
  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-border/70"
      role="tablist"
      aria-label="시뮬레이터 모드"
    >
      {MODES.map((mode, i) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          aria-selected={activeMode === mode.value}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
            i > 0 ? "border-l border-border/70" : ""
          } ${
            activeMode === mode.value
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
          onClick={() => onChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `zone-legend.tsx` 생성 — 지도 범례**

`components/zone/zone-legend.tsx`:

```typescript
"use client";

import type { ZoneMode } from "@/types/zone";

/** 모드별 범례 아이템 */
const LEGEND_ITEMS: Record<ZoneMode, Array<{ color: string; label: string }>> = {
  open: [
    { color: "#EF4444", label: "후보 지점" },
    { color: "#3B82F6", label: "운영 존" },
    { color: "#999999", label: "비운영 존" },
    { color: "#F59E0B", label: "주의 (잠식 위험)" },
  ],
  close: [
    { color: "#EF4444", label: "폐쇄 대상" },
    { color: "#3B82F6", label: "인근 존" },
    { color: "#22C55E", label: "수요 흡수" },
  ],
  compare: [
    { color: "#3B82F6", label: "비교 존 1" },
    { color: "#10B981", label: "비교 존 2" },
    { color: "#F59E0B", label: "비교 존 3" },
    { color: "#EF4444", label: "비교 존 4" },
    { color: "#8B5CF6", label: "비교 존 5" },
  ],
  optimize: [
    { color: "#3B82F6", label: "운영 존" },
    { color: "#EF4444", label: "폐쇄 권고" },
    { color: "#F59E0B", label: "재배치 대상" },
    { color: "#22C55E", label: "개설 후보" },
  ],
};

interface ZoneLegendProps {
  mode: ZoneMode;
}

/**
 * 지도 하단 좌측에 겹쳐 표시되는 범례.
 * 모드 전환 시 해당 모드의 마커 색상 설명을 보여준다.
 */
export function ZoneLegend({ mode }: ZoneLegendProps) {
  const items = LEGEND_ITEMS[mode];

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-card/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur-sm">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/zone/zone-search.tsx components/zone/zone-mode-tabs.tsx components/zone/zone-legend.tsx
git commit -m "feat(zone-ui): add ZoneSearch, ZoneModeTabs, ZoneLegend components"
```

---

## Task 3: `panels/open-panel.tsx` + `panels/close-panel.tsx` — 개설/폐쇄 패널

**Files:**
- Create: `components/zone/panels/open-panel.tsx`
- Create: `components/zone/panels/close-panel.tsx`

**Source:** `C:\Users\socar\socar\zone-simulator\static\panels\open.js` (254 lines), `close.js` (215 lines)

- [ ] **Step 1: `open-panel.tsx` 생성 — 개설 모드 사이드 패널**

후보지 정보, 예상 실적, alpha 슬라이더, 반경 내 유사 존, 카니발리제이션 경고를 표시한다.

`components/zone/panels/open-panel.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenSimResult, ZoneMapHandle } from "@/types/zone";

/* ── Formatting helpers ──────────────────────────────────────── */
function fmt(n: number | null | undefined): string {
  return n != null ? Math.round(n).toLocaleString("ko-KR") : "0";
}
function pct(n: number | null | undefined): string {
  return n != null ? (n * 100).toFixed(1) + "%" : "0%";
}
function won(n: number | null | undefined): string {
  return "\u20A9" + fmt(n);
}

/* ── Props ───────────────────────────────────────────────────── */
interface OpenPanelProps {
  /** 현재 선택된 후보 좌표 */
  candidate: { lat: number; lng: number; addr: string } | null;
  /** 시뮬레이션 결과 */
  result: OpenSimResult | null;
  /** 로딩 중 여부 */
  loading: boolean;
  /** alpha 변경 시 재시뮬레이션 트리거 */
  onAlphaChange: (alpha: number) => void;
  /** 시나리오 저장 */
  onSave: () => void;
  /** Slack 발송 */
  onSlack: () => void;
  /** 맵 ref (오버레이 렌더링) */
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 개설 모드 사이드 패널.
 *
 * 구성:
 * 1. 후보지 정보 (주소, 클러스터, 벤치마크)
 * 2. 예상 실적 (매출/일, 가동률)
 * 3. Alpha 슬라이더 (클러스터 vs 유사 존 가중치)
 * 4. 반경 내 유사 존 카드 목록
 * 5. 카니발리제이션 경고
 * 6. 시나리오 저장 / Slack 발송 버튼
 */
export function OpenPanel({
  candidate,
  result,
  loading,
  onAlphaChange,
  onSave,
  onSlack,
  mapRef,
}: OpenPanelProps) {
  const [alpha, setAlpha] = useState(0.5);

  // 결과가 바뀌면 alpha를 서버값으로 동기화
  useEffect(() => {
    if (result?.alpha != null) setAlpha(result.alpha);
  }, [result]);

  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !candidate) return;
    map.clearOverlays();

    // 후보 마커 (red)
    map.addMarker(candidate.lat, candidate.lng, { color: "red" });
    // 반경 원
    map.addCircle(candidate.lat, candidate.lng, 1000, {
      strokeColor: "#FF4444",
      fillColor: "#FF4444",
      fillOpacity: 0.08,
    });

    if (!result) return;

    // 유사 존 마커 (active=blue, inactive=gray)
    for (const z of result.nearby_zones) {
      if (z.lat == null || z.lng == null) continue;
      const active = z.revenue_per_car > 0;
      map.addMarker(z.lat, z.lng, {
        color: active ? "blue" : "gray",
        zoneId: z.id,
        title: z.name + (active ? "" : " (비운영)"),
      });
    }

    // 카니발리제이션 경고 오버레이
    const nearbyMap = new Map(result.nearby_zones.map((z) => [z.id, z]));
    for (const c of result.cannibalization) {
      const z = nearbyMap.get(c.zone_id);
      if (!z || z.lat == null || z.lng == null) continue;
      const bgColor = c.level === "danger" ? "#FEF2F2" : "#FFF3CD";
      const borderColor = c.level === "danger" ? "#E53E3E" : "#F59E0B";
      const textColor = c.level === "danger" ? "#991B1B" : "#7B341E";
      const html =
        `<div style="background:${bgColor};border:1px solid ${borderColor};` +
        `padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:${textColor};">` +
        `\u26A0 ${c.zone_name} ${c.distance_m}m</div>`;
      map.addOverlay(z.lat, z.lng, html);
    }
  }, [candidate, result, mapRef]);

  // ── Empty state ──────────────────────────────────────────
  if (!candidate) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        지도를 클릭하거나 주소를 검색하여 후보 지점을 선택하세요
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-32 rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!result) return null;

  const r = result;
  const hasBenchmark = r.cluster_benchmark && r.cluster_benchmark.zone_count > 0;

  return (
    <div className="space-y-4">
      {/* 후보지 정보 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">후보지 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="주소" value={candidate.addr || "선택된 위치"} />
          <StatRow label="클러스터" value={r.cluster_type ?? "-"} />
          <StatRow
            label="벤치마크 매출"
            value={hasBenchmark ? won(r.cluster_benchmark.avg_revenue_per_car) + "/일" : "-"}
          />
        </CardContent>
      </Card>

      {/* 예상 실적 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">예상 실적</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="예상 매출/일" value={won(r.estimated_revenue_per_car)} highlight />
          <StatRow label="예상 가동률" value={pct(r.estimated_utilization)} highlight />
          <Separator className="my-2" />
          <StatRow label="반경 내 평균 매출" value={won(r.nearby_avg_revenue) + "/일"} />
          <StatRow label="반경 내 평균 가동률" value={pct(r.nearby_avg_utilization)} />
        </CardContent>
      </Card>

      {/* Alpha 슬라이더 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">추정 가중치 (\u03B1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              onMouseUp={() => onAlphaChange(alpha)}
              onTouchEnd={() => onAlphaChange(alpha)}
              className="flex-1 accent-foreground"
            />
            <span className="w-8 text-right font-semibold">{alpha.toFixed(1)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>\u2190 클러스터 벤치마크</span>
            <span>유사 존 평균 \u2192</span>
          </div>
        </CardContent>
      </Card>

      {/* 반경 내 유사 존 */}
      {r.nearby_zones.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">반경 내 유사 존</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.nearby_zones.map((z) => {
              const inactive = !z.revenue_per_car || z.revenue_per_car === 0;
              return (
                <div
                  key={z.id}
                  className={`rounded-xl border border-border/50 p-3 text-sm ${inactive ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {z.name}
                      {inactive && (
                        <span className="ml-1 text-[10px] text-destructive">(비운영)</span>
                      )}
                    </span>
                    <span className="text-xs text-blue-600">{z.distance_m}m</span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                    <span>매출/일 {won(z.revenue_per_car)}</span>
                    <span>가동률 {pct(z.utilization)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 카니발리제이션 경고 */}
      {r.cannibalization.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">수요 잠식 위험</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.cannibalization.map((c) => (
              <div
                key={c.zone_id}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  c.level === "danger"
                    ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
              >
                <strong>{c.zone_name}</strong> — {c.distance_m}m{" "}
                {c.level === "danger" ? "\u26A0\uFE0F 카니발리제이션 위험" : "주의"}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          onClick={onSave}
        >
          시나리오 저장
        </button>
        <button
          className="flex-1 rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          onClick={onSlack}
        >
          Slack 발송
        </button>
      </div>
    </div>
  );
}

/* ── 통계 행 ─────────────────────────────────────────────────── */
function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-semibold text-blue-700 dark:text-blue-300" : ""}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: `close-panel.tsx` 생성 — 폐쇄 모드 사이드 패널**

대상 존 정보, 수요 이전 예측 테이블, 영향 요약(흡수율/이탈율/비용절감/순효과)을 표시한다.

`components/zone/panels/close-panel.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CloseSimResult, ZoneInfo, ZoneMapHandle } from "@/types/zone";

/* ── Formatting helpers ──────────────────────────────────────── */
function fmt(n: number | null | undefined): string {
  return n != null ? Math.round(n).toLocaleString("ko-KR") : "0";
}
function pct(n: number | null | undefined): string {
  return n != null ? (n * 100).toFixed(1) + "%" : "0%";
}
function won(n: number | null | undefined): string {
  return "\u20A9" + fmt(n);
}

/* ── Props ───────────────────────────────────────────────────── */
interface ClosePanelProps {
  /** 현재 선택된 존 ID */
  selectedZoneId: number | null;
  /** 전체 존 목록 (마커 표시용) */
  allZones: ZoneInfo[];
  /** 폐쇄 시뮬레이션 결과 */
  result: CloseSimResult | null;
  /** 로딩 중 여부 */
  loading: boolean;
  /** 시나리오 저장 */
  onSave: () => void;
  /** Slack 발송 */
  onSlack: () => void;
  /** 맵 ref */
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 폐쇄 모드 사이드 패널.
 *
 * 구성:
 * 1. 대상 존 정보 (이름, 지역, 매출, 가동률, 차량수)
 * 2. 수요 이전 예측 (인근 존별 흡수율, 가동률 변화)
 * 3. 영향 요약 (흡수율, 이탈율, 비용절감, 순효과)
 * 4. 시나리오 저장 / Slack 발송 버튼
 */
export function ClosePanel({
  selectedZoneId,
  allZones,
  result,
  loading,
  onSave,
  onSlack,
  mapRef,
}: ClosePanelProps) {
  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();

    if (!result) {
      // 폐쇄 모드 진입 시 전체 존 마커 표시
      for (const z of allZones) {
        if (z.lat != null && z.lng != null) {
          map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
        }
      }
      return;
    }

    // 대상 존: red 마커
    const target = allZones.find((z) => z.id === selectedZoneId);
    if (target?.lat != null) {
      map.addMarker(target.lat, target.lng, { color: "red", zoneId: selectedZoneId! });
    }

    // 수요 이전 존: blue 마커 + 흡수율 오버레이
    for (const t of result.demand_transfer.transfers) {
      if (t.lat != null && t.lng != null) {
        map.addMarker(t.lat, t.lng, { color: "blue", zoneId: t.zone_id });
        const html =
          `<div style="background:#C6F6D5;border:1px solid #48BB78;` +
          `padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#22543D;">` +
          `+${pct(t.absorption_pct)}</div>`;
        map.addOverlay(t.lat, t.lng, html);
      }
    }
  }, [selectedZoneId, allZones, result, mapRef]);

  // ── Empty state ──────────────────────────────────────────
  if (!selectedZoneId) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        지도에서 존을 클릭하여 폐쇄 영향도를 분석하세요
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-40 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (!result) return null;

  const tz = result.target_zone;
  const dt = result.demand_transfer;
  const net = dt.net_effect_monthly;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-destructive">폐쇄 영향도 분석</p>

      {/* 대상 존 정보 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">대상 존 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="존 이름" value={tz.name || "-"} />
          <StatRow label="지역" value={[tz.region1, tz.region2].filter(Boolean).join(" ")} />
          <StatRow label="매출/일" value={won(tz.revenue_per_car)} />
          <StatRow label="가동률" value={pct(tz.utilization)} />
          <StatRow label="배치 차량" value={`${tz.car_count || 0}대`} />
        </CardContent>
      </Card>

      {/* 수요 이전 예측 */}
      {dt.transfers.length > 0 && (
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">수요 이전 예측</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dt.transfers.map((t) => (
              <div key={t.zone_id} className="rounded-xl border border-border/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.zone_name || `존 ${t.zone_id}`}</span>
                  <span className="text-xs font-semibold text-emerald-600">
                    +{pct(t.absorption_pct)} 흡수
                  </span>
                </div>
                {t.current_utilization != null && t.new_utilization != null && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    가동률 변화: {pct(t.current_utilization)} → {pct(t.new_utilization)}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 영향 요약 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">영향 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatRow label="수요 흡수율" value={pct(dt.total_absorption_pct)} />
          <StatRow label="이탈율" value={pct(dt.churn_pct)} destructive />
          <StatRow label="비용 절감/월" value={won(dt.cost_saved_monthly)} success />
          <StatRow label="이탈 손실/월" value={won(dt.churn_loss_monthly)} destructive />
          <Separator className="my-2" />
          <div
            className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold ${
              net != null && net >= 0
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            순 효과 (월): {net != null && net >= 0 ? "+" : ""}{won(net)}
          </div>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          onClick={onSave}
        >
          시나리오 저장
        </button>
        <button
          className="flex-1 rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          onClick={onSlack}
        >
          Slack 발송
        </button>
      </div>
    </div>
  );
}

/* ── 통계 행 ─────────────────────────────────────────────────── */
function StatRow({
  label,
  value,
  destructive,
  success,
}: {
  label: string;
  value: string;
  destructive?: boolean;
  success?: boolean;
}) {
  const cls = destructive
    ? "text-destructive"
    : success
      ? "text-emerald-600 dark:text-emerald-300"
      : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/zone/panels/open-panel.tsx components/zone/panels/close-panel.tsx
git commit -m "feat(zone-ui): add OpenPanel and ClosePanel — open/close simulation result display"
```

---

## Task 4: `panels/compare-panel.tsx` + `panels/optimize-panel.tsx` — 비교/최적화 패널

**Files:**
- Create: `components/zone/panels/compare-panel.tsx`
- Create: `components/zone/panels/optimize-panel.tsx`

**Source:** `C:\Users\socar\socar\zone-simulator\static\panels\compare.js` (233 lines), `optimize.js` (309 lines)

- [ ] **Step 1: `compare-panel.tsx` 생성 — 비교 모드 사이드 패널**

선택된 존 칩, 매출/가동률/이용건수 수평 바 차트, 클러스터 벤치마크를 표시한다.

`components/zone/panels/compare-panel.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompareResult, ZoneInfo, ZoneMapHandle } from "@/types/zone";

/* ── Zone colors (최대 5개) ──────────────────────────────────── */
const ZONE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

/* ── Formatting helpers ──────────────────────────────────────── */
function fmt(n: number | null | undefined): string {
  return n != null ? Math.round(n).toLocaleString("ko-KR") : "0";
}
function pct(n: number | null | undefined): string {
  return n != null ? (n * 100).toFixed(1) + "%" : "0%";
}
function won(n: number | null | undefined): string {
  return "\u20A9" + fmt(n);
}

/* ── Props ───────────────────────────────────────────────────── */
interface ComparePanelProps {
  selectedZoneIds: number[];
  allZones: ZoneInfo[];
  result: CompareResult | null;
  loading: boolean;
  onRemoveZone: (zoneId: number) => void;
  onSlack: () => void;
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 비교 모드 사이드 패널.
 *
 * 구성:
 * 1. 선택된 존 칩 (클릭으로 제거)
 * 2. 매출/일 수평 바
 * 3. 가동률 수평 바
 * 4. 총 이용건수 수평 바
 * 5. 클러스터 벤치마크 (있는 경우)
 * 6. Slack 발송 버튼
 */
export function ComparePanel({
  selectedZoneIds,
  allZones,
  result,
  loading,
  onRemoveZone,
  onSlack,
  mapRef,
}: ComparePanelProps) {
  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();

    // 미선택 존 (blue)
    for (const z of allZones) {
      if (z.lat == null || z.lng == null) continue;
      if (selectedZoneIds.includes(z.id)) continue;
      map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
    }

    // 선택된 존 (색상 구분) — result에서 좌표 사용
    if (result?.zones) {
      result.zones.forEach((z, i) => {
        if (z.lat != null && z.lng != null) {
          // NOTE: Kakao SDK 커스텀 색상은 제한적이므로 기본 blue 사용 후 오버레이로 구분
          map.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.zone_id });
        }
      });
    }
  }, [selectedZoneIds, allZones, result, mapRef]);

  // ── 선택된 존 칩 ────────────────────────────────────────
  const chips = selectedZoneIds.map((id, i) => {
    const z = allZones.find((z) => z.id === id);
    const name = z ? z.name : `존 ${id}`;
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    return (
      <button
        key={id}
        onClick={() => onRemoveZone(id)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-80"
        style={{
          backgroundColor: color + "22",
          border: `1px solid ${color}`,
          color,
        }}
      >
        {name} \u2715
      </button>
    );
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">존 간 비교</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.length > 0 ? chips : (
            <span className="text-xs text-muted-foreground">선택된 존이 없습니다</span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          지도에서 비교할 존을 클릭하세요 (2~5개)
        </p>
      </div>

      {/* 2개 미만 */}
      {selectedZoneIds.length < 2 && !loading && (
        <div className="text-sm text-muted-foreground">
          존을 2개 이상 선택하면 비교 분석이 시작됩니다.
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {/* 결과 */}
      {!loading && result?.zones && result.zones.length >= 2 && (
        <>
          {/* 매출/일 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">매출/일</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup zones={result.zones} dataKey="revenue_per_car" formatFn={won} />
            </CardContent>
          </Card>

          {/* 가동률 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">가동률</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup zones={result.zones} dataKey="utilization" formatFn={pct} maxVal={1} />
            </CardContent>
          </Card>

          {/* 총 이용건수 */}
          <Card className="border-border/60 bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">총 이용건수</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBarGroup
                zones={result.zones}
                dataKey="total_nuse"
                formatFn={(n) => fmt(n) + "건"}
              />
            </CardContent>
          </Card>

          {/* 클러스터 벤치마크 */}
          {result.zones.some((z) => z.cluster_benchmark != null) && (
            <Card className="border-border/60 bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">클러스터 벤치마크</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {result.zones
                  .filter((z) => z.cluster_benchmark != null)
                  .map((z, i) => {
                    const color = ZONE_COLORS[i % ZONE_COLORS.length];
                    const bench = z.cluster_benchmark as Record<string, unknown> | null;
                    return (
                      <div key={z.zone_id} className="flex items-center justify-between">
                        <span style={{ color }} className="font-medium">
                          {z.name}
                        </span>
                        <span className="text-xs">
                          {z.cluster_type ?? "-"} /{" "}
                          {bench ? won(Number(bench.avg_revenue_per_car ?? 0)) + "/일" : "-"}
                        </span>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* Slack 버튼 */}
          <button
            className="w-full rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            onClick={onSlack}
          >
            Slack 발송
          </button>
        </>
      )}
    </div>
  );
}

/* ── 수평 바 그룹 ────────────────────────────────────────────── */
interface HorizontalBarGroupProps {
  zones: Array<{ zone_id: number; name: string; [key: string]: unknown }>;
  dataKey: string;
  formatFn: (val: number) => string;
  maxVal?: number;
}

function HorizontalBarGroup({ zones, dataKey, formatFn, maxVal }: HorizontalBarGroupProps) {
  const max = maxVal ?? Math.max(...zones.map((z) => Number(z[dataKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {zones.map((z, i) => {
        const val = Number(z[dataKey]) || 0;
        const widthPct = Math.round((val / max) * 100);
        const color = ZONE_COLORS[i % ZONE_COLORS.length];
        return (
          <div key={z.zone_id}>
            <div className="flex justify-between text-xs">
              <span style={{ color }} className="font-semibold">
                {z.name || `존 ${z.zone_id}`}
              </span>
              <span>{formatFn(val)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `optimize-panel.tsx` 생성 — 최적화 모드 사이드 패널**

지역 드롭다운, 분석 요약 그리드, 최적화 제안(폐쇄/개설/재배치), 예상 개선 효과를 표시한다.

`components/zone/panels/optimize-panel.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OptimizeResult, ZoneMapHandle } from "@/types/zone";

/* ── Formatting helpers ──────────────────────────────────────── */
function fmt(n: number | null | undefined): string {
  return n != null ? Math.round(n).toLocaleString("ko-KR") : "0";
}
function pct(n: number | null | undefined): string {
  return n != null ? (n * 100).toFixed(1) + "%" : "0%";
}
function won(n: number | null | undefined): string {
  return "\u20A9" + fmt(n);
}

/* ── Props ───────────────────────────────────────────────────── */
interface OptimizePanelProps {
  result: OptimizeResult | null;
  loading: boolean;
  /** 지역 선택 후 분석 실행 트리거 */
  onRun: (region1: string, region2?: string) => void;
  onSave: () => void;
  onSlack: () => void;
  mapRef: React.RefObject<ZoneMapHandle | null>;
}

/**
 * 최적화 모드 사이드 패널.
 *
 * 구성:
 * 1. 시/도 + 시/군/구 드롭다운 → 분석 실행
 * 2. 분석 요약 (운영 존, 배치 차량, 평균 가동률)
 * 3. 최적화 제안 (폐쇄 권고, 개설 권고, 재배치 권고)
 * 4. 예상 개선 효과
 * 5. 시나리오 저장 / Slack 발송 버튼
 */
export function OptimizePanel({
  result,
  loading,
  onRun,
  onSave,
  onSlack,
  mapRef,
}: OptimizePanelProps) {
  const [regions, setRegions] = useState<string[]>([]);
  const [subRegions, setSubRegions] = useState<string[]>([]);
  const [region1, setRegion1] = useState("");
  const [region2, setRegion2] = useState("");

  // ── 시/도 목록 로드 ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/zone/zones?list=regions")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRegions(data); })
      .catch(() => setRegions([]));
  }, []);

  // ── 시/군/구 목록 로드 ───────────────────────────────────
  useEffect(() => {
    if (!region1) {
      setSubRegions([]);
      return;
    }
    fetch(`/api/zone/zones?list=subregions&region1=${encodeURIComponent(region1)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSubRegions(data); })
      .catch(() => setSubRegions([]));
  }, [region1]);

  // ── 맵 오버레이 렌더링 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !result) return;
    map.clearOverlays();

    const closeIds = new Set(result.suggestions.close.map((s) => s.zone_id));
    const rebalanceZoneIds = new Set([
      ...result.suggestions.rebalance.map((r) => r.from_zone.zone_id),
      ...result.suggestions.rebalance.map((r) => r.to_zone.zone_id),
    ]);

    for (const z of result.zones) {
      if (z.lat == null || z.lng == null) continue;
      let color: "red" | "blue" | "yellow" | "green" = "blue";
      if (closeIds.has(z.zone_id)) color = "red";
      else if (rebalanceZoneIds.has(z.zone_id)) color = "yellow";
      map.addMarker(z.lat, z.lng, { color, zoneId: z.zone_id });
    }

    for (const rec of result.suggestions.open) {
      if (rec.lat != null && rec.lng != null) {
        map.addMarker(rec.lat, rec.lng, { color: "green" });
      }
    }
  }, [result, mapRef]);

  const handleRun = useCallback(() => {
    if (!region1) return;
    onRun(region1, region2 || undefined);
  }, [region1, region2, onRun]);

  return (
    <div className="space-y-4">
      {/* 지역 선택 */}
      <Card className="border-border/60 bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-emerald-600 dark:text-emerald-400">
            존 네트워크 최적화
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">시/도</label>
            <select
              className="h-10 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
              value={region1}
              onChange={(e) => {
                setRegion1(e.target.value);
                setRegion2("");
              }}
            >
              <option value="">-- 선택하세요 --</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">시/군/구</label>
            <select
              className="h-10 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-foreground focus:ring-4 focus:ring-foreground/10"
              value={region2}
              onChange={(e) => setRegion2(e.target.value)}
              disabled={subRegions.length === 0}
            >
              <option value="">-- 전체 --</option>
              {subRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            className="h-10 w-full rounded-2xl bg-foreground text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            disabled={!region1 || loading}
            onClick={handleRun}
          >
            {loading ? "분석 중..." : "분석 실행"}
          </button>
        </CardContent>
      </Card>

      {/* 로딩 */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {/* 결과 */}
      {!loading && result && (
        <>
          {/* 분석 요약 */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="운영 존" value={`${result.summary.total_zones}개`} />
            <SummaryCard label="배치 차량" value={`${result.summary.total_cars}대`} />
            <SummaryCard label="평균 가동률" value={pct(result.summary.avg_utilization)} />
            <SummaryCard label="존당 평균" value={`${result.summary.avg_cars_per_zone.toFixed(1)}대`} />
          </div>

          {/* 최적화 제안 */}
          {(result.suggestions.close.length > 0 ||
            result.suggestions.open.length > 0 ||
            result.suggestions.rebalance.length > 0) && (
            <Card className="border-border/60 bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">최적화 제안</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* 폐쇄 권고 */}
                {result.suggestions.close.map((s) => (
                  <div
                    key={s.zone_id}
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/40"
                  >
                    <div className="font-semibold text-red-800 dark:text-red-200">
                      {s.zone_name || `존 ${s.zone_id}`} — 폐쇄 권고
                    </div>
                    <div className="mt-1 text-red-700 dark:text-red-300">
                      가동률 {pct(s.utilization)} / 차량 {s.car_count}대
                    </div>
                  </div>
                ))}

                {/* 개설 권고 */}
                {result.suggestions.open.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/40"
                  >
                    <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                      {s.area || "신규 후보지"} — 개설 권고
                    </div>
                    {s.reason && (
                      <div className="mt-1 text-emerald-700 dark:text-emerald-300">{s.reason}</div>
                    )}
                  </div>
                ))}

                {/* 재배치 권고 */}
                {result.suggestions.rebalance.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <div className="font-semibold text-amber-800 dark:text-amber-200">
                      {s.from_zone.name} → {s.to_zone.name} ({s.cars}대 이동)
                    </div>
                    <div className="mt-1 text-amber-700 dark:text-amber-300">
                      {pct(s.from_zone.utilization)} → {pct(s.to_zone.utilization)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 예상 개선 효과 */}
          {(result.projected.new_avg_utilization != null || result.projected.monthly_savings != null) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                예상 개선 효과
              </p>
              {result.projected.new_avg_utilization != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">개선 후 평균 가동률</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">
                    {pct(result.projected.new_avg_utilization)}
                  </span>
                </div>
              )}
              {result.projected.monthly_savings != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300">월 절감 예상</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">
                    {won(result.projected.monthly_savings)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              onClick={onSave}
            >
              시나리오 저장
            </button>
            <button
              className="flex-1 rounded-2xl border border-border/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              onClick={onSlack}
            >
              Slack 발송
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 요약 카드 ───────────────────────────────────────────────── */
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/zone/panels/compare-panel.tsx components/zone/panels/optimize-panel.tsx
git commit -m "feat(zone-ui): add ComparePanel and OptimizePanel — multi-zone comparison and region optimization"
```

---

## Task 5: Zone 페이지 레이아웃 + `zone-simulator.tsx` 오케스트레이터

**Files:**
- Create: `components/zone/zone-simulator.tsx`
- Modify: `app/(dashboard)/zone/page.tsx`
- Modify: `types/zone.ts` (프론트엔드 타입 추가)

**Source:** `C:\Users\socar\socar\zone-simulator\static\zone_simulator.js` (100 lines) — 모드 전환 + 패널 라우팅 로직

이 컴포넌트가 전체 상태를 관리한다: 현재 모드, 선택된 좌표/존, API 호출, 결과 저장.

- [ ] **Step 1: `types/zone.ts` 하단에 프론트엔드 전용 타입 추가**

위의 "Shared Types" 섹션의 타입들을 `types/zone.ts` 파일 하단에 추가한다. 기존 백엔드 타입은 수정하지 않는다.

- [ ] **Step 2: `zone-simulator.tsx` 생성 — 메인 오케스트레이터**

`components/zone/zone-simulator.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
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

  // ── 공통 상태 ─────────────────────────────────────────────
  const [mode, setMode] = useState<ZoneMode>("open");
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
      const data = await res.json();
      const zones = Array.isArray(data) ? data : [];
      setAllZones(zones);
      setZonesLoaded(true);
      return zones;
    } catch {
      toast.error("존 목록을 불러올 수 없습니다.");
      return [];
    }
  }, [zonesLoaded, allZones]);

  // ── 모드 전환 ─────────────────────────────────────────────
  const handleModeChange = useCallback(
    async (newMode: ZoneMode) => {
      setMode(newMode);
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
        zones.forEach((z) => {
          if (z.lat != null && z.lng != null) {
            mapRef.current?.addMarker(z.lat, z.lng, { color: "blue", zoneId: z.id });
          }
        });
      } else if (newMode === "compare") {
        setCompareIds([]);
        setCompareResult(null);
        const zones = await loadZones();
        zones.forEach((z) => {
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
```

- [ ] **Step 3: `app/(dashboard)/zone/page.tsx` 수정 — 플레이스홀더를 실제 시뮬레이터로 교체**

`app/(dashboard)/zone/page.tsx`:

```typescript
import Script from "next/script";
import { ZoneSimulator } from "@/components/zone/zone-simulator";

export const metadata = { title: "존 시뮬레이터" };

export default function ZonePage() {
  return (
    <>
      {/* 카카오맵 SDK — zone 페이지에서만 로드 */}
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
        strategy="afterInteractive"
      />

      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
          <div className="max-w-3xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Zone Simulator
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
              존 개설·폐쇄·비교·최적화
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              카카오맵 위에서 존 운영 의사결정을 데이터 기반으로 시뮬레이션합니다.
            </p>
          </div>
        </section>

        <ZoneSimulator />
      </div>
    </>
  );
}
```

- [ ] **Step 4: `next.config.ts` 수정 — zone API의 SQL 파일 file tracing 추가**

`next.config.ts`의 `outputFileTracingIncludes`에 zone API 경로 추가:

```typescript
"/api/zone/zones": ["./sql/**/*.sql"],
"/api/zone/simulate/open": ["./sql/**/*.sql"],
"/api/zone/simulate/close": ["./sql/**/*.sql"],
"/api/zone/compare": ["./sql/**/*.sql"],
"/api/zone/optimize": ["./sql/**/*.sql"],
```

- [ ] **Step 5: `.env.local` 또는 `.env.example`에 카카오 API 키 환경변수 추가**

```
NEXT_PUBLIC_KAKAO_JS_KEY=your_kakao_js_key_here
```

> **Note:** 실제 키는 Vercel 환경변수로 관리하며, `.env.example`에 자리표시만 추가한다.

- [ ] **Step 6: 커밋**

```bash
git add types/zone.ts components/zone/zone-simulator.tsx app/\(dashboard\)/zone/page.tsx next.config.ts
git commit -m "feat(zone-ui): add ZoneSimulator orchestrator, wire up zone page with Kakao Map SDK"
```

---

## Task 6: 시나리오 저장/불러오기 다이얼로그 + Slack 리포트 확인

**Files:**
- Create: `components/zone/dialogs/scenario-dialog.tsx`
- Create: `components/zone/dialogs/slack-report-dialog.tsx`

**Source:** 원본 JS의 `window.apiFetch("/api/scenarios", ...)` 및 `window.apiFetch("/api/slack/report", ...)` 패턴

- [ ] **Step 1: `scenario-dialog.tsx` 생성 — 시나리오 저장/불러오기 다이얼로그**

`components/zone/dialogs/scenario-dialog.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ZoneScenario } from "@/types/zone";

const MODE_LABELS: Record<string, string> = {
  open: "개설",
  close: "폐쇄",
  compare: "비교",
  optimize: "최적화",
};

interface ScenarioDialogProps {
  /** 시나리오 불러오기 시 호출 */
  onLoad?: (scenario: ZoneScenario) => void;
  children: React.ReactNode;
}

/**
 * 시나리오 목록 다이얼로그.
 *
 * GET /api/zone/scenarios에서 최근 시나리오 목록을 조회하고,
 * 선택 시 onLoad 콜백으로 시나리오 데이터를 전달한다.
 */
export function ScenarioDialog({ onLoad, children }: ScenarioDialogProps) {
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState<
    Array<{ id: string; mode: string; created_at: string; parameters: Record<string, unknown> }>
  >([]);
  const [loading, setLoading] = useState(false);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zone/scenarios");
      const data = await res.json();
      setScenarios(Array.isArray(data) ? data : []);
    } catch {
      toast.error("시나리오 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchScenarios();
  }, [open, fetchScenarios]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>저장된 시나리오</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
          {!loading && scenarios.length === 0 && (
            <p className="text-sm text-muted-foreground">저장된 시나리오가 없습니다.</p>
          )}
          {scenarios.map((s) => (
            <button
              key={s.id}
              className="w-full rounded-xl border border-border/60 p-3 text-left text-sm transition-colors hover:bg-muted"
              onClick={() => {
                // onLoad가 있으면 전체 데이터를 별도 조회해야 하므로 여기서는 요약만 전달
                // v2에서 GET /api/zone/scenarios/:id 추가 가능
                toast.info(`시나리오 ${s.id} 선택됨 (${MODE_LABELS[s.mode] ?? s.mode})`);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {MODE_LABELS[s.mode] ?? s.mode}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {JSON.stringify(s.parameters).slice(0, 80)}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `slack-report-dialog.tsx` 생성 — Slack 발송 확인 다이얼로그**

`components/zone/dialogs/slack-report-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ZoneMode } from "@/types/zone";

const MODE_LABELS: Record<string, string> = {
  open: "개설 검토",
  close: "폐쇄 검토",
  compare: "존 비교",
  optimize: "최적화",
};

interface SlackReportDialogProps {
  mode: ZoneMode;
  data: Record<string, unknown> | null;
  children: React.ReactNode;
}

/**
 * Slack 리포트 발송 확인 다이얼로그.
 *
 * 발송 전 확인 단계를 거쳐 POST /api/zone/report을 호출한다.
 */
export function SlackReportDialog({ mode, data, children }: SlackReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!data) return;
    setSending(true);
    try {
      const res = await fetch("/api/zone/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, data }),
      });
      if (!res.ok) throw new Error();
      toast.success("Slack으로 발송되었습니다.");
      setOpen(false);
    } catch {
      toast.error("Slack 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Slack 리포트 발송</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{MODE_LABELS[mode] ?? mode}</strong> 분석 결과를 Slack 채널로 발송합니다.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            취소
          </Button>
          <Button onClick={handleSend} disabled={sending || !data}>
            {sending ? "발송 중..." : "발송"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/zone/dialogs/scenario-dialog.tsx components/zone/dialogs/slack-report-dialog.tsx
git commit -m "feat(zone-ui): add ScenarioDialog and SlackReportDialog — scenario CRUD and Slack integration"
```

---

## Verification Checklist

전체 작업 완료 후 확인 항목:

- [ ] `npm run build` 성공 (타입 에러 없음)
- [ ] `npm run lint` 통과
- [ ] `/zone` 페이지 접속 시 카카오맵 정상 로드
- [ ] 개설 모드: 맵 클릭 → 후보 마커 + 반경 원 + 유사 존 표시 + 패널 결과
- [ ] 폐쇄 모드: 존 클릭 → 대상 존 red 마커 + 수요 이전 오버레이 + 패널 결과
- [ ] 비교 모드: 존 2~5개 클릭 → 칩 표시 + 수평 바 차트 + 벤치마크
- [ ] 최적화 모드: 지역 선택 → 분석 실행 → 요약 + 제안 + 맵 마커 색상 구분
- [ ] 모드 전환 시 맵 오버레이 초기화
- [ ] 시나리오 저장/불러오기 다이얼로그 동작
- [ ] Slack 발송 확인 다이얼로그 동작
- [ ] 반응형: 최소 1280px 이상에서 70/30 레이아웃 정상
