"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CampaignListItem } from "@/types/roas";

interface CampaignListProps {
  onSelectCampaign: (policyId: number) => void;
  selectedPolicyId: number | null;
}

const QUICK_DATE_OPTIONS = [
  { label: "1개월", months: 1 },
  { label: "3개월", months: 3 },
  { label: "6개월", months: 6 },
  { label: "12개월", months: 12 },
];

const DIVISIONS = ["지역사업", "마케팅", "사업"];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateRange(months: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return { start: formatDate(start), end: formatDate(end) };
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return formatNumber(Math.round(n));
}

export function CampaignList({ onSelectCampaign, selectedPolicyId }: CampaignListProps) {
  const defaultRange = getDateRange(3);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedDivisions, setCheckedDivisions] = useState<string[]>([...DIVISIONS]);
  const [loading, setLoading] = useState(false);

  const setQuickDate = (months: number) => {
    const range = getDateRange(months);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const toggleDivision = (div: string) => {
    setCheckedDivisions((prev) =>
      prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]
    );
  };

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      toast.error("날짜를 선택해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const resp = await fetch(`/api/roas/campaigns?${params}`);
      if (!resp.ok) throw new Error("조회 실패");
      const data: CampaignListItem[] = await resp.json();
      setCampaigns(data);
      if (data.length === 0) {
        toast.info("해당 기간에 캠페인이 없습니다.");
      }
    } catch {
      toast.error("캠페인 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (!checkedDivisions.includes(c.division)) return false;
      if (searchQuery) {
        const pid = String(c.policy_id);
        if (/^\d+$/.test(searchQuery)) {
          if (pid !== searchQuery && !pid.startsWith(searchQuery)) return false;
        } else {
          if (!c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [campaigns, checkedDivisions, searchQuery]);

  return (
    <Card className="border-border/60 bg-card/95 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.16)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">캠페인 검색</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 날짜 + 퀵 버튼 */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_DATE_OPTIONS.map((opt) => (
              <Button
                key={opt.months}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setQuickDate(opt.months)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">시작일</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">종료일</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} size="sm" className="h-8">
              {loading ? "검색 중..." : "검색"}
            </Button>
          </div>
        </div>

        {/* 구분 필터 + 검색어 */}
        {campaigns.length > 0 && (
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-3">
              {DIVISIONS.map((div) => (
                <label key={div} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedDivisions.includes(div)}
                    onChange={() => toggleDivision(div)}
                    className="rounded"
                  />
                  <span className="text-xs">{div}</span>
                </label>
              ))}
            </div>
            <Input
              placeholder="정책번호 또는 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 text-xs"
            />
            <span className="text-xs text-muted-foreground">
              {filteredCampaigns.length}건
            </span>
          </div>
        )}

        {/* 테이블 */}
        {filteredCampaigns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">정책번호</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">정책명</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">구분</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">시작일</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">종료일</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">발급</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">사용</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">사용률</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">매출</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">할인</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground">ROAS</th>
                  <th className="py-2 px-3 text-center font-medium text-muted-foreground">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr
                    key={c.policy_id}
                    onClick={() => onSelectCampaign(c.policy_id)}
                    className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-muted/30 ${
                      selectedPolicyId === c.policy_id ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-mono">{c.policy_id}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate" title={c.name}>
                      {c.name}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge variant="outline" className="text-[10px]">{c.division}</Badge>
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground">{c.start_date}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground">{c.end_date}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(c.issued)}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(c.used)}</td>
                    <td className="py-2 px-3 text-right">{(c.usage_rate * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right">{formatMoney(c.revenue)}</td>
                    <td className="py-2 px-3 text-right">{formatMoney(c.discount)}</td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        c.roas >= 100 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {c.roas.toFixed(0)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      {c.is_ongoing ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700">진행중</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">종료</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {campaigns.length > 0 && filteredCampaigns.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            필터 조건에 맞는 캠페인이 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
