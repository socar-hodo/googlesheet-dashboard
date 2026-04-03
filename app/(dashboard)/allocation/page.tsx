import { AllocationForm } from "@/components/allocation/allocation-form";

export const dynamic = "force-dynamic";

export default function AllocationPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-[0_24px_60px_-42px_rgba(20,26,36,0.18)]">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Allocation
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
            배분 조건 설정 및 실행 결과
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            차종, 세그먼트, 기준일을 바탕으로 권역별 배분 결과를 실행하고 점수 근거까지 함께 확인합니다.
          </p>
        </div>
      </section>

      <AllocationForm />
    </div>
  );
}
