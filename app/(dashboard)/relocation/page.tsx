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
            재배치 추천 — v1.3 Zone-level 이동 명령
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            클러스터 탄력성(α) + 탁송비 실측 공식 기반 전국 재배치 시뮬레이션.
            189 region2 클러스터 매칭 후 zone 단위 이동 명령을 생성하고 CSV로 배차팀에 전달할 수 있습니다.
          </p>
        </div>
      </section>

      <RelocationForm />
    </div>
  );
}
