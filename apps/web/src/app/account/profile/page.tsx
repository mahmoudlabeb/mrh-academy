"use client";

import { ProfileManagementPage } from "@/components/shared/ProfileManagementPage";
import { useLanguage } from "@/contexts/language-context";

export default function AccountProfilePage() {
  const { lang } = useLanguage();
  return (
    <ProfileManagementPage
      title={lang === "ar" ? "الملف الشخصي للحساب" : "Account profile"}
    />
  );
}
