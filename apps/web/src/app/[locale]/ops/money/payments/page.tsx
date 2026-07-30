"use client";

import PaymentsTab from "@/app/admin/components/PaymentsTab";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function OpsPaymentsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      eyebrow={
        lang === "ar"
          ? "تدقيق مالي موثّق من مزوّد الدفع"
          : "Provider-verified financial audit"
      }
      title={lang === "ar" ? "سجل المدفوعات" : "Payment ledger"}
    >
      <PaymentsTab />
    </WorkspaceSection>
  );
}
