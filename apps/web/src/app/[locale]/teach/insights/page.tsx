"use client";

import Insights from "@/app/tutor/components/Insights";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function TutorInsightsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      eyebrow={lang === "ar" ? "أداء التدريس" : "Teaching performance"}
      title={lang === "ar" ? "الإحصاءات" : "Insights"}
    >
      <Insights />
    </WorkspaceSection>
  );
}
