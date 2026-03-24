import { RelocationForm } from "@/components/relocation/relocation-form";

export const metadata = { title: "차량 재배치 | Workspace Hub" };

export default function RelocationPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">차량 재배치</h1>
        <p className="text-sm text-muted-foreground mt-1">
          존별 복합 스코어를 기반으로 차량 재배치 의사결정을 지원합니다.
        </p>
      </div>
      <RelocationForm />
    </div>
  );
}
