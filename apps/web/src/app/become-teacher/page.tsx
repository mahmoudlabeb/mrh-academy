"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

type Certificate = { subject: string; name: string; dateRange: string };
type Education = { degree: string; major: string; university: string; dateRange: string };

const STEPS = [
  "المعلومات الأساسية",
  "الصورة الشخصية",
  "الشهادات",
  "التعليم",
  "الوصف والخبرة",
  "الفيديو التعريفي",
  "التوفر والأوقات",
  "التسعير"
];

export default function BecomeTeacherWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState("");

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [subject, setSubject] = useState("");
  const [phone, setPhone] = useState("");
  const [languages, setLanguages] = useState("");
  const [timezone, setTimezone] = useState("");

  // Step 2
  const [avatar, setAvatar] = useState<File | null>(null);

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

  // Step 7
  const [availability] = useState<Record<string, string>>({});

  // Step 8
  const [hourlyRate, setHourlyRate] = useState<number>(15);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      formData.append("country", country);
      formData.append("specialization", subject);
      formData.append("phone", phone);
      formData.append("timezone", timezone);
      
      const langArray = languages.split(",").map(l => l.trim()).filter(l => l);
      langArray.forEach((lang, i) => formData.append(`languages[${i}]`, lang));
      
      formData.append("bio", intro);
      formData.append("experience", experience);
      formData.append("motivation", motivation);
      formData.append("headline", headline);
      
      formData.append("hourlyRate", String(hourlyRate));
      if (videoUrl) formData.append("videoUrl", videoUrl);

      if (avatar) formData.append("avatar", avatar);
      formData.append("certificates", JSON.stringify(certificates));
      formData.append("education", JSON.stringify(education));
      formData.append("availability", JSON.stringify(availability));

      const { data } = await apiClient.post("/tutors/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => router.push("/"),
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      setSubmitError(err?.response?.data?.message || "Failed to submit application");
    },
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 8));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>المعلومات الأساسية</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>الاسم الأول</label><input value={firstName} onChange={e => setFirstName(e.target.value)} className="input-field" /></div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>اسم العائلة</label><input value={lastName} onChange={e => setLastName(e.target.value)} className="input-field" /></div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>البريد الإلكتروني</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" /></div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>رقم الهاتف</label><input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" /></div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>المادة التي ستدرسها</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field">
                  <option value="">اختر المادة</option>
                  <option value="English">الإنجليزية</option>
                  <option value="Arabic">العربية</option>
                </select>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>البلد</label><input value={country} onChange={e => setCountry(e.target.value)} className="input-field" /></div>
              <div className="col-span-2"><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>اللغات التي تتحدثها (مفصولة بفاصلة)</label><input value={languages} onChange={e => setLanguages(e.target.value)} className="input-field" /></div>
              <div className="col-span-2"><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>المنطقة الزمنية</label><input value={timezone} onChange={e => setTimezone(e.target.value)} className="input-field" placeholder="مثال: Asia/Riyadh" /></div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-fade-in text-center">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>الصورة الشخصية</h2>
            <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center border border-dashed border-gray-400 overflow-hidden">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(avatar)} className="w-full h-full object-cover" alt="Avatar preview" />
              ) : (
                <span className="text-gray-400">لا توجد صورة</span>
              )}
            </div>
            <div className="mt-4">
              <input type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0] || null)} className="input-field max-w-xs mx-auto" />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>الشهادات</h2>
            {certificates.map((cert, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={cert.subject} readOnly className="input-field text-sm" />
                <input value={cert.name} readOnly className="input-field text-sm" />
                <button onClick={() => setCertificates(c => c.filter((_, idx) => idx !== i))} className="btn-secondary px-3 text-red-500">إزالة</button>
              </div>
            ))}
            <button onClick={() => setCertificates([...certificates, { subject: 'مادة', name: 'شهادة جديدة', dateRange: '2023' }])} className="btn-secondary text-sm">+ إضافة شهادة (نموذج)</button>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>التعليم</h2>
            {education.map((edu, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={edu.degree} readOnly className="input-field text-sm" />
                <input value={edu.university} readOnly className="input-field text-sm" />
                <button onClick={() => setEducation(e => e.filter((_, idx) => idx !== i))} className="btn-secondary px-3 text-red-500">إزالة</button>
              </div>
            ))}
            <button onClick={() => setEducation([...education, { degree: 'بكالوريوس', major: 'تخصص', university: 'جامعة', dateRange: '2019-2023' }])} className="btn-secondary text-sm">+ إضافة تعليم (نموذج)</button>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>الوصف والخبرة</h2>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>العنوان الرئيسي (Headline)</label><input value={headline} onChange={e => setHeadline(e.target.value)} className="input-field" placeholder="مثال: معلم لغة إنجليزية ذو خبرة 5 سنوات" /></div>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>المقدمة</label><textarea value={intro} onChange={e => setIntro(e.target.value)} className="input-field resize-none h-20" /></div>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>خبرة التدريس</label><textarea value={experience} onChange={e => setExperience(e.target.value)} className="input-field resize-none h-20" /></div>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>الدافع للتدريس</label><textarea value={motivation} onChange={e => setMotivation(e.target.value)} className="input-field resize-none h-20" /></div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>الفيديو التعريفي</h2>
            <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>رابط يوتيوب / فيميو</label><input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="input-field" placeholder="https://..." /></div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>التوفر والأوقات</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>هذه الشاشة تمثل شبكة الأوقات الأسبوعية. سيتمكن الطلاب من حجز الدروس في الأوقات التي تحددها هنا.</p>
            <div className="p-8 border border-dashed rounded-xl text-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
               <p className="font-semibold" style={{ color: 'var(--text-main)' }}>[شبكة الأوقات هنا]</p>
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>التسعير</h2>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>سعر الدرس في الساعة (USD)</label>
              <div className="flex items-center gap-4">
                <input type="range" min="5" max="100" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} className="flex-1" />
                <span className="font-bold text-xl" style={{ color: '#D4A353' }}>${hourlyRate}</span>
              </div>
            </div>
            {submitError && <div className="text-sm p-3 rounded mt-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{submitError}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="dashboard-header">
        <div className="max-w-3xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold" style={{ color: '#FFFFF0' }}>كن معلمًا</h1>
          <Link href="/" className="btn-secondary px-4 py-2 text-sm text-white" style={{ borderColor: '#1D535B' }}>إلغاء</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
             <span className="text-sm font-semibold" style={{ color: '#D4A353' }}>الخطوة {step} من 8</span>
             <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{STEPS[step - 1]}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
            <div className="h-full transition-all duration-300" style={{ width: `${(step / 8) * 100}%`, background: '#D4A353' }} />
          </div>
        </div>

        <div className="card p-8 min-h-[400px] flex flex-col justify-between">
          {renderStep()}
          
          <div className="flex justify-between mt-12 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button 
              onClick={prevStep} 
              disabled={step === 1 || applyMutation.isPending} 
              className={`btn-secondary px-6 py-2 text-sm ${step === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              السابق
            </button>
            
            {step < 8 ? (
              <button onClick={nextStep} className="btn-primary px-8 py-2 text-sm">التالي</button>
            ) : (
              <button 
                onClick={() => applyMutation.mutate()} 
                disabled={applyMutation.isPending} 
                className="btn-primary px-8 py-2 text-sm flex items-center gap-2"
              >
                {applyMutation.isPending ? 'جاري الإرسال...' : 'تقديم الطلب'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
