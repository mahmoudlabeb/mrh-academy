"use client";

import LessonsTab from "@/app/admin/components/LessonsTab";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function OpsLessonsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection title={lang === "ar" ? "سجل الدروس" : "Lessons Record"}>
      <LessonsTab />
    </WorkspaceSection>
  );
}
