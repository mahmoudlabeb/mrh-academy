"use client";

import { useLanguage } from "@/contexts/language-context";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function PrivacyPage() {
  const { lang } = useLanguage();

  return (
    <div
      className="public-navbar-offset min-h-screen"
      style={{ background: "var(--bg-main)" }}
    >
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1
          className="text-3xl font-bold mb-8"
          style={{ color: "var(--text-main)" }}
        >
          {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
        </h1>
        <div
          className="space-y-6 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {lang === "ar" ? (
            <>
              <p>
                نحن في Mr.H Academy نلتزم بحماية خصوصية مستخدمينا. توضح سياسة
                الخصوصية هذه كيفية جمع واستخدام وحماية معلوماتك الشخصية.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                المعلومات التي نجمعها
              </h2>
              <p>
                نقوم بجمع المعلومات التالية: الاسم، البريد الإلكتروني، رقم
                الهاتف، معلومات الدفع، وسجل الدروس.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                كيف نستخدم معلوماتك
              </h2>
              <p>
                نستخدم معلوماتك لتقديم وتحسين خدماتنا، ومعالجة المدفوعات،
                والتواصل معك بشأن الدروس والحساب.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                حماية المعلومات
              </h2>
              <p>
                نستخدم إجراءات أمنية لحماية معلوماتك من الوصول غير المصرح به أو
                التعديل أو الإفصاح.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                اتصل بنا
              </h2>
              <p>
                للاستفسارات حول سياسة الخصوصية، يرجى التواصل عبر البريد
                الإلكتروني: hello@mrhacademy.com
              </p>
            </>
          ) : (
            <>
              <p>
                At Mr.H Academy, we are committed to protecting your privacy.
                This policy explains how we collect, use, and safeguard your
                personal information.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Information We Collect
              </h2>
              <p>
                We collect the following information: name, email address, phone
                number, payment details, and lesson history.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                How We Use Your Information
              </h2>
              <p>
                We use your information to provide and improve our services,
                process payments, and communicate with you regarding lessons and
                account.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Data Protection
              </h2>
              <p>
                We implement security measures to protect your information from
                unauthorized access, alteration, or disclosure.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Contact Us
              </h2>
              <p>
                For privacy-related inquiries, contact us at:
                hello@mrhacademy.com
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
