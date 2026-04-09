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

  /* ── Load SDK + Init map ────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    function initMap() {
      if (cancelled || !containerRef.current) return;
      kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
          level: initialLevel,
        });
        mapRef.current = map;
        kakao.maps.event.addListener(map, "click", (...args: unknown[]) => {
          const evt = args[0] as { latLng: kakao.maps.LatLng };
          onMapClickRef.current?.(evt.latLng.getLat(), evt.latLng.getLng(), null);
        });
      });
    }

    // 이미 로드됨
    if (window.kakao?.maps) { initMap(); return () => { cancelled = true; mapRef.current = null; }; }

    // SDK 스크립트 삽입 (page.tsx의 Script 태그와 무관하게 확실히 로드)
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) {
      console.error("[ZoneMap] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.");
      return;
    }
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      // 스크립트 태그는 있지만 아직 로딩 중 — 폴링
      const poll = setInterval(() => {
        if (cancelled) { clearInterval(poll); return; }
        if (window.kakao?.maps) { clearInterval(poll); initMap(); }
      }, 100);
      return () => { cancelled = true; clearInterval(poll); mapRef.current = null; };
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => { if (!cancelled) initMap(); };
    script.onerror = () => console.error("[ZoneMap] 카카오맵 SDK 로드 실패");
    document.head.appendChild(script);

    return () => { cancelled = true; mapRef.current = null; };
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
