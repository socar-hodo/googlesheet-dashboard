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
