"use client";

import StudentsList from "@/app/tutor/components/StudentsList";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function TutorStudentsRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      eyebrow={lang === "ar" ? "علاقات التعلّم" : "Learning relationships"}
      title={lang === "ar" ? "طلابي" : "My Students"}
      description={
        lang === "ar"
          ? "الطلاب المرتبطون بدروس مؤكدة معك فقط."
          : "Learners connected to your confirmed teaching activity."
      }
    >
      <StudentsList />
    </WorkspaceSection>
  );
}
