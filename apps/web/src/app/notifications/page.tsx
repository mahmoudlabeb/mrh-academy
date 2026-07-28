"use client";

import { useRouter } from "next/navigation";
import NotificationsPanel from "@/app/student/components/NotificationsPanel";
import { useLanguage } from "@/contexts/language-context";

export default function NotificationsPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  return (
    <main className="focus-page">
      <header className="focus-page-header">
        <h1>{lang === "ar" ? "الإشعارات" : "Notifications"}</h1>
      </header>
      <section className="focus-panel">
        <NotificationsPanel onClose={() => router.back()} />
      </section>
    </main>
  );
}
