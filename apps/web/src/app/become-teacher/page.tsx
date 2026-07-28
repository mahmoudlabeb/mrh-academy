"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";

type Certificate = { subject: string; name: string; dateRange: string };
type Education = {
  degree: string;
  major: string;
  university: string;
  dateRange: string;
};

const STEPS = [
  ["المعلومات الأساسية", "Basic information"],
  ["الصورة الشخصية", "Profile photo"],
  ["الشهادات", "Certificates"],
  ["التعليم", "Education"],
  ["الوصف والخبرة", "Profile and experience"],
  ["الفيديو التعريفي", "Introduction video"],
  ["التوفر والأوقات", "Availability"],
  ["التسعير", "Pricing"],
];

export default function BecomeTeacherWizard() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/become-teacher");
      return;
    }
    if (user.role !== "student") {
      router.replace(user.role === "tutor" ? "/tutor" : "/student");
    }
  }, [user, authLoading, router]);

  // Step 1
  const [country, setCountry] = useState("");
  const [subject, setSubject] = useState("");
  const [languages, setLanguages] = useState("");

  // Step 2 — verification document (PDF/Word)
  const [document, setDocument] = useState<File | null>(null);

  // Step 3
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Step 4
  const [education, setEducation] = useState<Education[]>([]);

  // Step 5
  const [headline, setHeadline] = useState("");
  const [intro, setIntro] = useState("");
  const [experience, setExperience] = useState("");
  const [motivation, setMotivation] = useState("");

  // Step 6
  const [videoUrl, setVideoUrl] = useState("");

  // Step 7 — availability set after approval in tutor dashboard

  // Step 8
  const [hourlyRate, setHourlyRate] = useState<number>(15);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const langArray = languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      const bioParts = [
        headline && `Headline: ${headline}`,
        intro && `Introduction: ${intro}`,
        experience && `Experience: ${experience}`,
        motivation && `Motivation: ${motivation}`,
        country && `Country: ${country}`,
        certificates.length > 0 &&
          `Certificates: ${JSON.stringify(certificates)}`,
        education.length > 0 && `Education: ${JSON.stringify(education)}`,
      ].filter(Boolean);
      const bio = bioParts.join("\n\n");
      if (bio.length < 50) {
        throw new Error(
          t(
            "يجب ألا تقل النبذة عن 50 حرفاً",
            "Bio must be at least 50 characters",
          ),
        );
      }
      if (!subject) {
        throw new Error(t("التخصص مطلوب", "Specialization is required"));
      }
      if (langArray.length === 0) {
        throw new Error(
          t(
            "يجب إضافة لغة واحدة على الأقل",
            "At least one language is required",
          ),
        );
      }

      const formData = new FormData();
      formData.append("bio", bio);
      formData.append("specialization", subject);
      langArray.forEach((lang) => formData.append("languages", lang));
      formData.append("hourlyRate", String(hourlyRate));
      if (videoUrl) formData.append("videoUrl", videoUrl);
      if (document) formData.append("document", document);

      const { data } = await apiClient.post("/tutors/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => router.push("/student?tab=settings"),
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const apiMsg = err?.response?.data?.message;
      const msg = Array.isArray(apiMsg) ? apiMsg.join(", ") : apiMsg;
      setSubmitError(
        msg ||
          err?.message ||
          t("تعذر إرسال الطلب", "Failed to submit application"),
      );
    },
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 8));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("المعلومات الأساسية", "Basic information")}
            </h2>
            {user && (
              <p
                className="text-sm mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                {user.firstName} {user.lastName} — {user.email}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("المادة التي ستدرسها", "Subject you will teach")}
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field"
                >
                  <option value="">
                    {t("اختر المادة", "Choose a subject")}
                  </option>
                  <option value="English">{t("الإنجليزية", "English")}</option>
                  <option value="Arabic">{t("العربية", "Arabic")}</option>
                </select>
              </div>
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {t("البلد", "Country")}
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="col-span-2">
                <label
                  className="block text-sm mb-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {t(
                    "اللغات التي تتحدثها (مفصولة بفاصلة)",
                    "Languages you speak (comma separated)",
                  )}
                </label>
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="input-field"
                  placeholder="Arabic, English"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-fade-in text-center">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("وثيقة التحقق", "Verification document")}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              {t(
                "ارفع شهادة أو سيرة ذاتية بصيغة PDF أو Word (اختياري)",
                "Upload a certificate or rأ©sumأ© as PDF or Word (optional)",
              )}
            </p>
            <div className="mt-4">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={(e) => setDocument(e.target.files?.[0] || null)}
                className="input-field max-w-xs mx-auto"
              />
              {document && (
                <p
                  className="text-xs mt-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {document.name}
                </p>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("الشهادات", "Certificates")}
            </h2>
            {certificates.map((cert, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={cert.subject}
                  readOnly
                  className="input-field text-sm"
                />
                <input
                  value={cert.name}
                  readOnly
                  className="input-field text-sm"
                />
                <button
                  onClick={() =>
                    setCertificates((c) => c.filter((_, idx) => idx !== i))
                  }
                  className="btn-secondary px-3 text-[var(--danger)]"
                >
                  {t("إزالة", "Remove")}
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setCertificates([
                  ...certificates,
                  {
                    subject: t("مادة", "Subject"),
                    name: t("شهادة جديدة", "New certificate"),
                    dateRange: "2023",
                  },
                ])
              }
              className="btn-secondary text-sm"
            >
              {t("+ إضافة شهادة (نموذج)", "+ Add sample certificate")}
            </button>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("التعليم", "Education")}
            </h2>
            {education.map((edu, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  value={edu.degree}
                  readOnly
                  className="input-field text-sm"
                />
                <input
                  value={edu.university}
                  readOnly
                  className="input-field text-sm"
                />
                <button
                  onClick={() =>
                    setEducation((e) => e.filter((_, idx) => idx !== i))
                  }
                  className="btn-secondary px-3 text-[var(--danger)]"
                >
                  {t("إزالة", "Remove")}
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setEducation([
                  ...education,
                  {
                    degree: t("بكالوريوس", "Bachelor"),
                    major: t("تخصص", "Major"),
                    university: t("جامعة", "University"),
                    dateRange: "2019-2023",
                  },
                ])
              }
              className="btn-secondary text-sm"
            >
              {t("+ إضافة تعليم (نموذج)", "+ Add sample education")}
            </button>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("الوصف والخبرة", "Profile and experience")}
            </h2>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("العنوان الرئيسي", "Headline")}
              </label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="input-field"
                placeholder={t(
                  "مثال: معلم لغة إنجليزية ذو خبرة 5 سنوات",
                  "Example: English tutor with 5 years of experience",
                )}
              />
            </div>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("المقدمة", "Introduction")}
              </label>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                className="input-field resize-none h-20"
              />
            </div>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("خبرة التدريس", "Teaching experience")}
              </label>
              <textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="input-field resize-none h-20"
              />
            </div>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("الدافع للتدريس", "Teaching motivation")}
              </label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="input-field resize-none h-20"
              />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("الفيديو التعريفي", "Introduction video")}
            </h2>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("رابط يوتيوب / فيميو", "YouTube / Vimeo link")}
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="input-field"
                placeholder="https://..."
              />
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("التوفر والأوقات", "Availability")}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              {t(
                "ستتمكن من تحديد أوقات التدريس الأسبوعية بعد اعتماد طلبك.",
                "You can set your weekly teaching times after your application is approved.",
              )}
            </p>
            <div
              className="p-8 border border-dashed rounded-xl text-center"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--bg-light)",
              }}
            >
              <p
                className="font-semibold"
                style={{ color: "var(--text-main)" }}
              >
                {t(
                  "تُضبط المواعيد من لوحة المعلم",
                  "Availability is managed from the tutor dashboard",
                )}
              </p>
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              {t("التسعير", "Pricing")}
            </h2>
            <div>
              <label
                className="block text-sm mb-1"
                style={{ color: "var(--text-main)" }}
              >
                {t("سعر الدرس في الساعة (USD)", "Hourly lesson rate (USD)")}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="flex-1"
                />
                <span
                  className="font-bold text-xl"
                  style={{ color: "var(--signal)" }}
                >
                  ${hourlyRate}
                </span>
              </div>
            </div>
            {submitError && (
              <div
                className="text-sm p-3 rounded mt-4"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }}
              >
                {submitError}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      <div className="dashboard-header">
        <div className="max-w-3xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--focus-ink)" }}
          >
            {t("كن معلمًا", "Become a tutor")}
          </h1>
          <Link
            href="/"
            className="btn-secondary px-4 py-2 text-sm text-white"
            style={{ borderColor: "var(--ink-muted)" }}
          >
            {t("إلغاء", "Cancel")}
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--signal)" }}
            >
              {t(`الخطوة ${step} من 8`, `Step ${step} of 8`)}
            </span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {STEPS[step - 1][lang === "ar" ? 0 : 1]}
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "var(--border-color)" }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(step / 8) * 100}%`,
                background: "var(--signal)",
              }}
            />
          </div>
        </div>

        <div className="card p-8 min-h-[400px] flex flex-col justify-between">
          {renderStep()}

          <div
            className="flex justify-between mt-12 pt-6 border-t"
            style={{ borderColor: "var(--border-color)" }}
          >
            <button
              onClick={prevStep}
              disabled={step === 1 || applyMutation.isPending}
              className={`btn-secondary px-6 py-2 text-sm ${step === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {t("السابق", "Previous")}
            </button>

            {step < 8 ? (
              <button
                onClick={nextStep}
                className="btn-primary px-8 py-2 text-sm"
              >
                {t("التالي", "Next")}
              </button>
            ) : (
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="btn-primary px-8 py-2 text-sm flex items-center gap-2"
              >
                {applyMutation.isPending
                  ? t("جاري الإرسال...", "Submitting...")
                  : t("تقديم الطلب", "Submit application")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
