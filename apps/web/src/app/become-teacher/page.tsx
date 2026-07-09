'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

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
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/become-teacher');
      return;
    }
    if (user.role !== 'student') {
      router.replace(user.role === 'tutor' ? '/tutor' : '/student');
    }
  }, [user, authLoading, router]);

  // Step 1
  const [country, setCountry] = useState('');
  const [subject, setSubject] = useState('');
  const [languages, setLanguages] = useState('');

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
      const langArray = languages.split(',').map((l) => l.trim()).filter(Boolean);
      const bioParts = [
        headline && `Headline: ${headline}`,
        intro && `Introduction: ${intro}`,
        experience && `Experience: ${experience}`,
        motivation && `Motivation: ${motivation}`,
        country && `Country: ${country}`,
        certificates.length > 0 && `Certificates: ${JSON.stringify(certificates)}`,
        education.length > 0 && `Education: ${JSON.stringify(education)}`,
      ].filter(Boolean);
      const bio = bioParts.join('\n\n');
      if (bio.length < 50) {
        throw new Error('Bio must be at least 50 characters');
      }
      if (!subject) {
        throw new Error('Specialization is required');
      }
      if (langArray.length === 0) {
        throw new Error('At least one language is required');
      }

      const formData = new FormData();
      formData.append('bio', bio);
      formData.append('specialization', subject);
      langArray.forEach((lang) => formData.append('languages', lang));
      formData.append('hourlyRate', String(hourlyRate));
      if (videoUrl) formData.append('videoUrl', videoUrl);
      if (document) formData.append('document', document);

      const { data } = await apiClient.post('/tutors/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => router.push('/student?tab=settings'),
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const apiMsg = err?.response?.data?.message;
      const msg = Array.isArray(apiMsg) ? apiMsg.join(', ') : apiMsg;
      setSubmitError(msg || err?.message || 'Failed to submit application');
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
            {user && (
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {user.firstName} {user.lastName} — {user.email}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>المادة التي ستدرسها</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field">
                  <option value="">اختر المادة</option>
                  <option value="English">الإنجليزية</option>
                  <option value="Arabic">العربية</option>
                </select>
              </div>
              <div><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>البلد</label><input value={country} onChange={e => setCountry(e.target.value)} className="input-field" /></div>
              <div className="col-span-2"><label className="block text-sm mb-1" style={{ color: 'var(--text-main)' }}>اللغات التي تتحدثها (مفصولة بفاصلة)</label><input value={languages} onChange={e => setLanguages(e.target.value)} className="input-field" placeholder="Arabic, English" /></div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 animate-fade-in text-center">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>وثيقة التحقق</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>ارفع شهادة أو سيرة ذاتية بصيغة PDF أو Word (اختياري)</p>
            <div className="mt-4">
              <input type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={e => setDocument(e.target.files?.[0] || null)} className="input-field max-w-xs mx-auto" />
              {document && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{document.name}</p>}
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
