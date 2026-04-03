import { RelocationForm } from "@/components/relocation/relocation-form";

export const metadata = { title: "재배치 추천 | Workspace Portal" };

export default function RelocationPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Relocation
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            재배치 조회 및 추천 결과
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            가동률, 매출, 사전예약 흐름을 바탕으로 이동 우선순위와 추천 차량 후보를 비교합니다.
          </p>
        </div>
      </section>

      <RelocationForm />
    </div>
  );
}
