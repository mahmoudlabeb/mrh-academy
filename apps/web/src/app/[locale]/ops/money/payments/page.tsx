"use client";

import PaymentsTab from "@/app/admin/components/PaymentsTab";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function OpsPaymentsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      eyebrow={lang === "ar" ? "سجل مالي محكوم" : "Controlled financial record"}
      title={lang === "ar" ? "المدفوعات" : "Payments"}
    >
      <PaymentsTab />
    </WorkspaceSection>
  );
}
