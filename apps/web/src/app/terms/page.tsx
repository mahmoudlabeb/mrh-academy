"use client";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useLanguage } from "@/contexts/language-context";

const COPY = {
  ar: {
    title: "شروط الاستخدام",
    intro:
      "باستخدام MRH Academy فإنك توافق على هذه الشروط. يرجى قراءتها بعناية قبل إنشاء حساب أو حجز خدمة.",
    sections: [
      [
        "الحسابات",
        "أنت مسؤول عن صحة بيانات حسابك والحفاظ على سرية بيانات الدخول، وعن جميع الأنشطة التي تتم من خلال حسابك.",
      ],
      [
        "الدروس والمدفوعات",
        "تتم الحجوزات والمدفوعات من خلال المنصة. تُطبّق الأسعار وسياسات الإلغاء والاسترداد الظاهرة وقت الشراء.",
      ],
      [
        "سلوك المستخدم",
        "يُحظر استخدام المنصة في نشاط غير قانوني أو مسيء أو محاولة تجاوز وسائل الحماية. يجوز تعليق الحسابات المخالفة.",
      ],
      [
        "تعديل الشروط",
        "قد نحدّث هذه الشروط عند الحاجة، وسنعلن التغييرات الجوهرية داخل المنصة أو عبر وسائل التواصل المسجلة.",
      ],
    ],
  },
  en: {
    title: "Terms of Service",
    intro:
      "By using MRH Academy, you agree to these terms. Please read them carefully before creating an account or booking a service.",
    sections: [
      [
        "Accounts",
        "You are responsible for accurate account information, safeguarding your credentials, and all activity performed through your account.",
      ],
      [
        "Lessons and payments",
        "Bookings and payments are handled through the platform. Prices and the cancellation and refund policies shown at purchase time apply.",
      ],
      [
        "User conduct",
        "Illegal, abusive, or security-bypassing activity is prohibited. Accounts that violate these rules may be suspended.",
      ],
      [
        "Changes to these terms",
        "We may update these terms when necessary and will announce material changes in the platform or through registered contact methods.",
      ],
    ],
  },
} as const;

export default function TermsPage() {
  const { lang } = useLanguage();
  const copy = COPY[lang];
  return (
    <div className="public-navbar-offset min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">{copy.title}</h1>
        <div className="space-y-6 leading-relaxed text-[var(--text-muted)]">
          <p>{copy.intro}</p>
          {copy.sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-xl font-bold mt-8 mb-4 text-[var(--text-main)]">
                {title}
              </h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
