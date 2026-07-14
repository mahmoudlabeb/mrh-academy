'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  averageRating?: number;
  reviewCount?: number;
  user: { firstName: string; lastName: string; avatarUrl?: string };
};

function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden" style={{ background: '#0F3A40' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-8" style={{ background: 'rgba(212, 163, 83,0.15)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.3)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#D4A353' }} />
            نقبل الآن طلبات المعلمين الجدد
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" style={{ color: '#FFFFF0' }}>
            أتقن أي لغة مع{' '}
            <span className="gradient-text">معلمين خبراء</span>
            <br />
            من جميع أنحاء العالم
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: '#E4CC9C' }}>
            تواصل مع معلمين لغات معتمدين، احجز جلسات فردية، وسرّع رحلة التعلم الخاصة بك مع إرشادات شخصية.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/student/discover"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}
            >
              ابحث عن معلم
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <Link
              href="/become-teacher"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold transition-all duration-300 hover:-translate-y-0.5"
              style={{ border: '1px solid rgba(212, 163, 83,0.4)', color: '#D4A353' }}
            >
              كن معلمًا
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { label: 'معلم نشط', value: '200+' },
              { label: 'لغة', value: '12+' },
              { label: 'طالب', value: '5,000+' },
              { label: 'تقييم', value: '4.8 ★' },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center animate-slide-up" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                <p className="text-2xl sm:text-3xl font-bold gold-accent">{stat.value}</p>
                <p className="text-sm mt-1" style={{ color: '#E4CC9C' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LanguagesSection() {
  return (
    <section className="py-20" style={{ background: 'var(--bg-main)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="group relative overflow-hidden rounded-3xl p-10 flex flex-col justify-end min-h-[300px] transition-all hover:-translate-y-2 hover:shadow-2xl cursor-pointer animate-slide-up" style={{ background: 'linear-gradient(135deg, #1D535B 0%, #0F3A40 100%)', animationDelay: '0.1s' }}>
            <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=100&fit=crop")' }} />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-2" style={{ color: '#D4A353' }}>English</h3>
              <p className="opacity-90 mb-4" style={{ color: '#FFFFF0' }}>Learn English with native speakers</p>
              <Link href="/student/discover?languages=English" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: '#D4A353' }}>
                Explore Tutors
                <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            {/* Background design elements */}
            <div className="absolute top-0 right-0 -me-8 -mt-8 w-40 h-40 rounded-full opacity-5 mix-blend-overlay" style={{ background: '#D4A353' }} />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: '#D4A353' }} />
          </div>

          <div className="group relative overflow-hidden rounded-3xl p-10 flex flex-col justify-end min-h-[300px] transition-all hover:-translate-y-2 hover:shadow-2xl cursor-pointer animate-slide-up" style={{ background: 'linear-gradient(135deg, #0F3A40 0%, #1D535B 100%)', animationDelay: '0.2s' }}>
            <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1580231649931-155cce7e868a?w=800&q=100&fit=crop")' }} />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-2" style={{ color: '#D4A353' }}>العربية</h3>
              <p className="opacity-90 mb-4" style={{ color: '#FFFFF0' }}>تعلم اللغة العربية مع معلمين معتمدين</p>
              <Link href="/student/discover?languages=العربية" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: '#D4A353' }}>
                تصفح المعلمين
                <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            {/* Background design elements */}
            <div className="absolute top-0 right-0 -me-8 -mt-8 w-40 h-40 rounded-full opacity-5 mix-blend-overlay" style={{ background: '#D4A353' }} />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: '#D4A353' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TopTutorsSection() {
  const { data: topTutors = [], isLoading } = useQuery({
    queryKey: ['top-tutors-homepage'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>('/tutors/top');
      return data;
    },
  });

  if (isLoading || topTutors.length === 0) return null;

  return (
    <section className="py-20" style={{ background: 'var(--bg-light)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>نخبة المعلمين لدينا</h2>
            <p className="mt-2 text-lg" style={{ color: 'var(--text-muted)' }}>أفضل المعلمين تقييمًا مستعدون لمساعدتك</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/student/discover" className="link font-semibold inline-flex items-center gap-1">
              عرض كل المعلمين
              <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {topTutors.slice(0, 3).map((tutor) => (
            <Link key={tutor.userId} href={`/tutors/${tutor.userId}`} className="card-gold p-6 flex flex-col group animate-slide-up">
              <div className="flex items-start gap-4 mb-4">
                {tutor.user.avatarUrl ? (
                  <Image src={tutor.user.avatarUrl} alt={tutor.user.firstName} width={56} height={56} className="w-14 h-14 rounded-full object-cover shadow-sm shrink-0 transition-transform group-hover:scale-110 border border-[#D4A353]" />
                ) : (
                  <Image src={`https://ui-avatars.com/api/?name=${tutor.user.firstName}&background=D4A353&color=fff&size=128`} alt={tutor.user.firstName} width={56} height={56} className="w-14 h-14 rounded-full object-cover shadow-sm shrink-0 transition-transform group-hover:scale-110 border border-[#D4A353]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-lg truncate" style={{ color: 'var(--text-main)' }}>{tutor.user.firstName} {tutor.user.lastName}</h3>
                    {tutor.averageRating && tutor.averageRating >= 4.5 && (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#D4A353' }}>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{tutor.specialization}</p>
                </div>
              </div>

              <p className="text-sm line-clamp-3 leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{tutor.bio}</p>

              <div className="flex flex-wrap gap-2 mb-5">
                {tutor.languages?.slice(0, 3).map((lang) => (
                  <span key={lang} className="badge text-xs" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}>{lang}</span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <span className="font-bold text-lg" style={{ color: '#D4A353' }}>${tutor.hourlyRate}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ساعة</span>
                </div>
                {tutor.averageRating !== undefined && (
                  <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                    <span style={{ color: '#D4A353' }}>★</span> {tutor.averageRating.toFixed(1)}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      title: 'تسجيل آمن',
      desc: 'نظام متقدم لمنع مشاركة الحسابات. سجل الدخول بأمان عبر البريد الإلكتروني أو Google.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      title: 'محرك بحث',
      desc: 'تصفح المئات من المعلمين المعتمدين حسب اللغة والسعر والتقييمات.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
        </svg>
      ),
      title: 'تدريب المعلمين',
      desc: 'وصول إلى مكتبة من المقالات والموارد المصممة لمساعدة المعلمين على تطوير مهاراتهم.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      title: 'جدولة ذكية',
      desc: 'نظام تقويم تفاعلي للمعلمين مع حماية من التداخل والمواعيد المتكررة.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
      title: 'تقييمات ومراجعات',
      desc: 'نظام شفاف للمراجعات مع تقييمات مفصلة من الطلاب الموثوقين.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#D4A353' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      title: 'إدارة المشرفين',
      desc: 'لوحة تحكم كاملة للمشرفين لمراجعة طلبات المعلمين وإدارة المقالات والإشراف على المنصة.',
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-main)' }}>
            كل ما تحتاجه للنجاح
          </h2>
          <p className="mt-4 text-lg" style={{ color: 'var(--text-muted)' }}>
            منصة متكاملة للتعلم والتدريس
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          {features.map((feature) => (
            <div key={feature.title} className="card-gold p-8 animate-slide-up">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110" style={{ background: 'rgba(212, 163, 83,0.15)' }}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-main)' }}>{feature.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <div className="card-premium p-12 sm:p-16 relative overflow-hidden animate-scale-in">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full animate-float opacity-20" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full animate-float opacity-15" style={{ background: 'radial-gradient(circle, #D4A353 0%, transparent 70%)', animationDelay: '2s' }} />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#FFFFF0' }}>
              هل أنت مستعد لبدء رحلتك؟
            </h2>
            <p className="text-lg mb-8 max-w-lg mx-auto" style={{ color: '#E4CC9C' }}>
              انضم إلى آلاف الطلاب والمعلمين على المنصة.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-1 animate-bounce-soft"
                style={{ background: 'linear-gradient(135deg, #F3E1B9, #B89754)', color: '#0F3A40' }}
              >
                ابدأ مجانًا
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <Link
                href="/teacher-training"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all hover:-translate-y-1"
                style={{ border: '1px solid rgba(212, 163, 83,0.4)', color: '#D4A353' }}
              >
                موارد المعلمين
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const dynamic = 'force-dynamic';

export default function Home() {
  const { setLanguage } = useLanguage();

  useEffect(() => {
    setLanguage('ar');
  }, [setLanguage]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Navbar />
      <main>
        <HeroSection />
        <LanguagesSection />
        <TopTutorsSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
