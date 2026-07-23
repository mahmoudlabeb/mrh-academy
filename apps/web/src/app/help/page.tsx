"use client";

import { useLanguage } from "@/contexts/language-context";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function HelpPage() {
  const { lang } = useLanguage();

  const sections =
    lang === "ar"
      ? [
          {
            title: "بدء الاستخدام",
            content:
              "سجل حساباً جديداً، ثم تصفح المعلمين المتاحين. يمكنك حجز درس تجريبي لمعرفة مدى مناسبة المعلم لأهدافك.",
          },
          {
            title: "حجز الدروس",
            content:
              "اختر معلمك المفضل، وحدد الوقت المناسب لك. سيتم خصم الرصيد تلقائياً عند تأكيد الحجز.",
          },
          {
            title: "فصل الدرس الافتراضي",
            content:
              "بعد الحجز، يمكنك الدخول إلى الفصل الافتراضي من لوحة التحكم. ستجد هناك السبورة البيضاء والدردشة والصوت والفيديو.",
          },
          {
            title: "حل المشاكل التقنية",
            content:
              "تأكد من اتصال الإنترنت، واستخدم متصفح محدث. للدعم الفني، تواصل معنا عبر البريد الإلكتروني.",
          },
        ]
      : [
          {
            title: "Getting Started",
            content:
              "Create a new account, then browse available tutors. Book a trial lesson to see if the tutor fits your goals.",
          },
          {
            title: "Booking Lessons",
            content:
              "Choose your preferred tutor and select a convenient time. Credits will be deducted automatically upon confirmation.",
          },
          {
            title: "Virtual Classroom",
            content:
              "After booking, enter the virtual classroom from your dashboard. You will find the whiteboard, chat, audio, and video.",
          },
          {
            title: "Technical Support",
            content:
              "Ensure you have a stable internet connection and use an updated browser. For technical support, contact us via email.",
          },
        ];

  return (
    <div
      className="public-navbar-offset min-h-screen"
      style={{ background: "var(--bg-main)" }}
    >
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--text-main)" }}
        >
          {lang === "ar" ? "مركز المساعدة" : "Help Center"}
        </h1>
        <p className="mb-10" style={{ color: "var(--text-muted)" }}>
          {lang === "ar"
            ? "كل ما تحتاج معرفته لاستخدام المنصة"
            : "Everything you need to know about using the platform"}
        </p>
        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="card p-6">
              <h2
                className="text-lg font-bold mb-3"
                style={{ color: "var(--text-main)" }}
              >
                {section.title}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </div>
        <div
          className="mt-12 card p-6 text-center"
          style={{ background: "var(--bg-light)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {lang === "ar"
              ? "لم تجد إجابتك؟ تواصل معنا"
              : "Did not find your answer? Contact us"}
          </p>
          <a
            href="mailto:hello@mrhacademy.com"
            className="text-sm font-semibold mt-2 inline-block"
            style={{ color: "#D4A353" }}
          >
            hello@mrhacademy.com
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
