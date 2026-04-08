import { RoasAnalysis } from "@/components/roas/roas-analysis";

export const metadata = { title: "캠페인 분석" };

export default function RoasAnalysisPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Campaign Analysis
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            캠페인 사후 분석
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            실행된 쿠폰 캠페인의 효과를 데이터로 분석하고 판정합니다.
          </p>
        </div>
      </section>

      <RoasAnalysis />
    </div>
  );
}
