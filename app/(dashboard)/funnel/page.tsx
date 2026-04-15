import type { Metadata } from "next";
import { FunnelContent } from "@/components/funnel/funnel-content";

export const metadata: Metadata = { title: "전환율 퍼널" };
export const dynamic = "force-dynamic";

export default function FunnelPage() {
  return (
    <div className="space-y-6">
      <FunnelContent />
    </div>
  );
}
