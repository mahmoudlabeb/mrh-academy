'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const faqsAr = [
  { q: 'كيف يمكنني حجز درس؟', a: 'يمكنك حجز درس من خلال البحث عن معلم مناسب، ثم النقر على "احجز درساً" واختيار الوقت المناسب.' },
  { q: 'كيف يمكنني إضافة رصيد؟', a: 'يمكنك إضافة رصيد من خلال لوحة التحكم، عبر بطاقة ائتمان أو باي بال أو أي من طرق الدفع المتاحة.' },
  { q: 'ماذا يحدث إذا تأخر المعلم؟', a: 'إذا تأخر المعلم، يمكنك تقديم بلاغ من خلال فصل الدرس الافتراضي وسيتم اتخاذ الإجراء المناسب.' },
  { q: 'هل يمكنني استرداد أموالي؟', a: 'يتم استرداد الرصيد في حال إلغاء الدرس قبل 24 ساعة من الموعد المحدد.' },
  { q: 'كيف أصبح معلماً على المنصة؟', a: 'يمكنك التقديم من خلال صفحة "كن معلماً" وتعبئة النموذج، وسيتم مراجعة طلبك من قبل الإدارة.' },
  { q: 'ما هي عمولة المنصة؟', a: 'تختلف العمولة حسب عدد ساعات التدريس. تبدأ من 30% وتنخفض إلى 12% للمعلمين ذوي الخبرة العالية.' },
];

const faqsEn = [
  { q: 'How do I book a lesson?', a: 'Search for a suitable tutor, click "Book a lesson", and choose a convenient time slot.' },
  { q: 'How do I add credits?', a: 'You can add credits from your dashboard via credit card, PayPal, or any of the available payment methods.' },
  { q: 'What if the tutor is late?', a: 'If the tutor is late, you can submit a report from the virtual classroom, and appropriate action will be taken.' },
  { q: 'Can I get a refund?', a: 'Credits are refunded if the lesson is cancelled at least 24 hours before the scheduled time.' },
  { q: 'How do I become a tutor?', a: 'Apply through the "Become a Teacher" page. Fill out the application form, and our admin team will review it.' },
  { q: 'What is the platform commission?', a: 'The commission varies based on teaching hours. It starts at 30% and decreases to 12% for experienced tutors.' },
];

export default function FAQPage() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = lang === 'ar' ? faqsAr : faqsEn;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
          {lang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
        </h1>
        <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ar' ? 'إجابات لأكثر الأسئلة شيوعاً' : 'Answers to the most common questions'}
        </p>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
                style={{ color: 'var(--text-main)' }}
              >
                <span className="font-medium text-sm">{faq.q}</span>
                <svg
                  className={`w-5 h-5 shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
