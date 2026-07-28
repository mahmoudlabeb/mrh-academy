"use client";

import StudentsTab from "@/app/admin/components/StudentsTab";
import TutorsTab from "@/app/admin/components/TutorsTab";
import { useLanguage } from "@/contexts/language-context";
import { WorkspaceSection } from "@/components/shared/WorkspaceSection";

export default function OpsPeopleRoute() {
  const { lang } = useLanguage();
  return (
    <WorkspaceSection
      eyebrow={lang === "ar" ? "إدارة الهوية والصلاحية" : "Identity and access"}
      title={lang === "ar" ? "دليل الأشخاص" : "People Directory"}
      description={
        lang === "ar"
          ? "تظهر الإجراءات وفق صلاحيات المشغّل الفعلية."
          : "Actions are constrained by the operator’s server-issued permissions."
      }
    >
      <div className="workspace-split">
        <section>
          <h2>{lang === "ar" ? "المعلّمون" : "Tutors"}</h2>
          <TutorsTab />
        </section>
        <section>
          <h2>{lang === "ar" ? "الطلاب" : "Learners"}</h2>
          <StudentsTab />
        </section>
      </div>
    </WorkspaceSection>
  );
}
