"use client";

import { useLanguage } from "@/contexts/language-context";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function TermsPage() {
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
          {lang === "ar" ? "شروط الاستخدام" : "Terms of Service"}
        </h1>
        <div
          className="space-y-6 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {lang === "ar" ? (
            <>
              <p>
                باستخدام منصة Mr.H Academy، فإنك توافق على هذه الشروط والأحكام.
                يرجى قراءتها بعناية.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                الحسابات
              </h2>
              <p>
                يجب عليك إنشاء حساب للوصول إلى خدماتنا. أنت مسؤول عن الحفاظ على
                سرية كلمة المرور الخاصة بك.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                الدروس والمدفوعات
              </h2>
              <p>
                يتم حجز الدروس من خلال المنصة. يتم خصم الرصيد عند تأكيد الحجز.
                يتم احتساب العمولات حسب هيكل الرسوم المعلن.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                سلوك المستخدم
              </h2>
              <p>
                يحظر استخدام المنصة لأي نشاط غير قانوني أو مسيء. نحتفظ بالحق في
                إنهاء الحسابات المخالفة.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                تعديل الشروط
              </h2>
              <p>
                نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعار المستخدمين
                بالتغييرات الهامة.
              </p>
            </>
          ) : (
            <>
              <p>
                By using Mr.H Academy, you agree to these terms and conditions.
                Please read them carefully.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Accounts
              </h2>
              <p>
                You must create an account to access our services. You are
                responsible for maintaining your password confidentiality.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Lessons & Payments
              </h2>
              <p>
                Lessons are booked through the platform. Balance is deducted
                upon booking confirmation. Commissions are calculated according
                to the published fee structure.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                User Conduct
              </h2>
              <p>
                Using the platform for any illegal or abusive activity is
                prohibited. We reserve the right to terminate violating
                accounts.
              </p>
              <h2
                className="text-xl font-bold mt-8 mb-4"
                style={{ color: "var(--text-main)" }}
              >
                Terms Modifications
              </h2>
              <p>
                We reserve the right to modify these terms at any time. Users
                will be notified of material changes.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
