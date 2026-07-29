"use client";

import SettingsTab from "@/app/admin/components/SettingsTab";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function OpsSettingsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      title={lang === "ar" ? "إعدادات المنصة" : "Platform Settings"}
    >
      <SettingsTab />
    </WorkspaceSection>
  );
}
