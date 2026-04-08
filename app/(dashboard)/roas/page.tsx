import { RoasSimulator } from "@/components/roas/roas-simulator";

export const metadata = { title: "ROAS 시뮬레이터" };

export default function RoasPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ROAS Simulator
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            쿠폰 캠페인 ROAS 시뮬레이션
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            지역, 존, 쿠폰 조건을 설정하고 투자 대비 수익을 예측합니다.
          </p>
        </div>
      </section>

      <RoasSimulator />
    </div>
  );
}
