"use client";

import { useState } from "react";
import { CampaignList } from "./campaign-list";
import { CampaignDetail } from "./campaign-detail";
import { CampaignImpact } from "./campaign-impact";

export function RoasAnalysis() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <CampaignList
        onSelectCampaign={setSelectedPolicyId}
        selectedPolicyId={selectedPolicyId}
      />

      {selectedPolicyId && (
        <>
          <CampaignDetail policyId={selectedPolicyId} />
          <CampaignImpact policyId={selectedPolicyId} />
        </>
      )}
    </div>
  );
}
