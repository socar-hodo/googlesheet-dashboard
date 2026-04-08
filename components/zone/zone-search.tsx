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
