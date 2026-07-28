"use client";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useLanguage } from "@/contexts/language-context";

const COPY = {
  ar: {
    title: "سياسة الخصوصية",
    intro:
      "نلتزم في MRH Academy بحماية خصوصيتك. توضح هذه السياسة البيانات التي نجمعها وكيف نستخدمها ونحميها.",
    sections: [
      [
        "المعلومات التي نجمعها",
        "نجمع بيانات الحساب والتواصل، ومعلومات الدفع الضرورية، وسجل الدروس والدورات، وبيانات الاستخدام اللازمة لتشغيل المنصة بأمان.",
      ],
      [
        "كيف نستخدم معلوماتك",
        "نستخدم معلوماتك لتقديم خدمات التعلم، ومعالجة المدفوعات، وإدارة حسابك، والتواصل معك، وتحسين أمان المنصة وأدائها.",
      ],
      [
        "حماية المعلومات",
        "نطبق ضوابط تقنية وتنظيمية للحد من الوصول غير المصرح به أو التعديل أو الإفصاح، ولا نخزن بيانات البطاقات الكاملة على خوادمنا.",
      ],
      [
        "حقوقك والتواصل معنا",
        "يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذف حسابك من إعدادات الحساب. للاستفسارات: hello@mrhacademy.com",
      ],
    ],
  },
  en: {
    title: "Privacy Policy",
    intro:
      "MRH Academy is committed to protecting your privacy. This policy explains what data we collect and how we use and safeguard it.",
    sections: [
      [
        "Information we collect",
        "We collect account and contact details, necessary payment information, lesson and course history, and usage data required to operate the platform securely.",
      ],
      [
        "How we use your information",
        "We use your information to provide learning services, process payments, manage your account, communicate with you, and improve platform security and performance.",
      ],
      [
        "Data protection",
        "We apply technical and organizational controls to reduce unauthorized access, alteration, or disclosure. We do not store complete card details on our servers.",
      ],
      [
        "Your rights and contact",
        "You may request access or corrections to your data, or delete your account from account settings. For privacy inquiries: hello@mrhacademy.com",
      ],
    ],
  },
} as const;

export default function PrivacyPage() {
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
