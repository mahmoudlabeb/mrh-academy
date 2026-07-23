'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import { useLanguage } from '@/contexts/language-context';
import { apiClient } from '@/lib/api-client';

type Language = 'ar' | 'en';

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

type Copy = {
  announcement: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  primary: string;
  secondary: string;
  stats: { value: string; label: string }[];
  constellation: {
    label: string;
    rating: string;
    availability: string;
  };
  discovery: {
    eyebrow: string;
    title: string;
    description: string;
    languages: { name: string; native: string; note: string; query: string }[];
  };
  tutors: {
    eyebrow: string;
    title: string;
    description: string;
    all: string;
    loading: string;
    emptyTitle: string;
    emptyCopy: string;
    hour: string;
    reviews: string;
  };
  process: {
    eyebrow: string;
    title: string;
    description: string;
    steps: { number: string; title: string; description: string }[];
    assurance: string;
    assuranceCopy: string;
  };
  cta: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
};

const COPY: Record<Language, Copy> = {
  ar: {
    announcement: 'نستقبل الآن طلبات المعلمين الجدد',
    eyebrow: 'تعليم شخصي • خبرة عالمية',
    title: (
      <>
        لغتك الجديدة تبدأ مع <em>المعلم المناسب</em>
      </>
    ),
    description:
      'تعلّم بثقة في جلسات فردية مباشرة مع معلمين مختارين بعناية، وخطة مرنة تتقدم مع أهدافك ووقتك.',
    primary: 'اكتشف معلمك',
    secondary: 'انضم كمعلم',
    stats: [
      { value: '200+', label: 'معلم متخصص' },
      { value: '12+', label: 'لغة متاحة' },
      { value: '5K+', label: 'طالب يتعلّم' },
      { value: '4.8', label: 'متوسط التقييم' },
    ],
    constellation: {
      label: 'معلمون يطابقون هدفك',
      rating: '4.9 تقييم',
      availability: 'مواعيد هذا الأسبوع',
    },
    discovery: {
      eyebrow: 'اختر مسارك',
      title: 'لغة واحدة. آفاق بلا حدود.',
      description:
        'ابدأ باللغة الأقرب لهدفك، ثم صفِّ المعلمين حسب الخبرة والسعر والموعد المناسب.',
      languages: [
        { name: 'English', native: 'الإنجليزية', note: 'للعمل والدراسة والسفر', query: 'English' },
        { name: 'العربية', native: 'Arabic', note: 'للتواصل والثقافة والطلاقة', query: 'العربية' },
        { name: 'Deutsch', native: 'الألمانية', note: 'لمسارك الأكاديمي والمهني', query: 'German' },
        { name: 'Français', native: 'الفرنسية', note: 'للمحادثة والاختبارات', query: 'French' },
      ],
    },
    tutors: {
      eyebrow: 'نخبة الأكاديمية',
      title: 'معلمون يصنعون فرقًا حقيقيًا',
      description: 'خبرات موثقة، أساليب متنوعة، وتقييمات تساعدك على الاختيار بثقة.',
      all: 'عرض كل المعلمين',
      loading: 'نبحث لك عن أفضل المعلمين…',
      emptyTitle: 'معلمك المناسب بانتظارك',
      emptyCopy: 'استكشف قائمة المعلمين وحدد اللغة والموعد المناسبين لك.',
      hour: '/ ساعة',
      reviews: 'مراجعة',
    },
    process: {
      eyebrow: 'رحلة واضحة',
      title: 'من هدفك إلى محادثتك الأولى',
      description: 'كل خطوة مصممة لتمنحك قرارًا أسهل وتعلّمًا أكثر تركيزًا.',
      steps: [
        { number: '01', title: 'حدّد ما تريد', description: 'اختر اللغة وهدفك ووقتك المتاح.' },
        { number: '02', title: 'قابل معلمك', description: 'قارن الملفات والتقييمات والأسعار بوضوح.' },
        { number: '03', title: 'ابدأ وتقدّم', description: 'احجز جلسة مباشرة وتابع تطورك خطوة بخطوة.' },
      ],
      assurance: 'ثقة في كل جلسة',
      assuranceCopy:
        'ملفات معلمين واضحة، تقييمات طلاب، مواعيد مرنة، وتجربة حجز منظمة من مكان واحد.',
    },
    cta: {
      eyebrow: 'خطوتك الأولى قريبة',
      title: 'ابدأ رحلة تعلّم تليق بطموحك',
      description: 'أنشئ حسابك واكتشف المعلم الذي يفهم هدفك وطريقتك في التعلّم.',
      primary: 'ابدأ الآن',
      secondary: 'تصفّح المعلمين',
    },
  },
  en: {
    announcement: 'Now welcoming new tutor applications',
    eyebrow: 'Personal learning • Global expertise',
    title: (
      <>
        Your next language starts with the <em>right tutor</em>
      </>
    ),
    description:
      'Learn with confidence in live one-to-one sessions, guided by carefully selected tutors and a flexible plan built around your goals.',
    primary: 'Discover your tutor',
    secondary: 'Apply as a tutor',
    stats: [
      { value: '200+', label: 'Specialist tutors' },
      { value: '12+', label: 'Languages' },
      { value: '5K+', label: 'Active learners' },
      { value: '4.8', label: 'Average rating' },
    ],
    constellation: {
      label: 'Tutors matched to your goal',
      rating: '4.9 rating',
      availability: 'Open this week',
    },
    discovery: {
      eyebrow: 'Choose your path',
      title: 'One language. A wider world.',
      description:
        'Start with the language closest to your goal, then filter tutors by expertise, price, and availability.',
      languages: [
        { name: 'English', native: 'الإنجليزية', note: 'For work, study, and travel', query: 'English' },
        { name: 'العربية', native: 'Arabic', note: 'For culture, connection, and fluency', query: 'العربية' },
        { name: 'Deutsch', native: 'German', note: 'For academic and career goals', query: 'German' },
        { name: 'Français', native: 'French', note: 'For conversation and exams', query: 'French' },
      ],
    },
    tutors: {
      eyebrow: 'Academy selection',
      title: 'Tutors who make progress personal',
      description: 'Verified expertise, distinct teaching styles, and reviews that help you choose well.',
      all: 'View all tutors',
      loading: 'Finding our best tutors for you…',
      emptyTitle: 'Your ideal tutor is waiting',
      emptyCopy: 'Explore our tutors, then choose the language and time that suit you.',
      hour: '/ hour',
      reviews: 'reviews',
    },
    process: {
      eyebrow: 'A clear journey',
      title: 'From your goal to your first conversation',
      description: 'Every step is designed to make choosing easier and learning more focused.',
      steps: [
        { number: '01', title: 'Define your goal', description: 'Choose your language, outcome, and available time.' },
        { number: '02', title: 'Meet your match', description: 'Compare profiles, reviews, pricing, and style.' },
        { number: '03', title: 'Learn and progress', description: 'Book a live lesson and build momentum every week.' },
      ],
      assurance: 'Confidence in every lesson',
      assuranceCopy:
        'Clear tutor profiles, learner reviews, flexible times, and an organized booking experience in one place.',
    },
    cta: {
      eyebrow: 'Your first step is close',
      title: 'Begin a learning journey worthy of your ambition',
      description: 'Create your account and find a tutor who understands your goals and how you learn.',
      primary: 'Start now',
      secondary: 'Browse tutors',
    },
  },
};

const FALLBACK_TUTORS = [
  { initials: 'SA', name: 'Sara Ahmed', subject: 'English • Conversation', tone: 'sand' },
  { initials: 'MK', name: 'Mariam Khalil', subject: 'Arabic • Foundations', tone: 'ivory' },
  { initials: 'OY', name: 'Omar Youssef', subject: 'German • Exams', tone: 'teal' },
];

function ArrowIcon({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg className={mirrored ? 'landing-arrow mirrored' : 'landing-arrow'} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h12m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InitialsAvatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return <span className={`initials-avatar ${className}`}>{initials || 'MH'}</span>;
}

function TutorPortrait({ tutor, className = '' }: { tutor?: TutorProfile; className?: string }) {
  const name = tutor ? `${tutor.user.firstName} ${tutor.user.lastName}` : 'Mr.H Tutor';

  if (tutor?.user.avatarUrl) {
    return (
      <Image
        src={tutor.user.avatarUrl}
        alt={name}
        fill
        sizes="(max-width: 640px) 42vw, 220px"
        className={`object-cover ${className}`}
      />
    );
  }

  return <InitialsAvatar name={name} className={className} />;
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="landing-section-intro">
      <p className="landing-eyebrow landing-eyebrow-dark">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="landing-section-copy">{description}</p>
    </header>
  );
}

function Hero({ copy, tutors, lang }: { copy: Copy; tutors: TutorProfile[]; lang: Language }) {
  const isAr = lang === 'ar';
  const visibleTutors = tutors.slice(0, 3);

  return (
    <section className="academy-hero" aria-labelledby="hero-title">
      <div className="academy-hero-grid" aria-hidden="true" />
      <div className="landing-shell academy-hero-layout">
        <div className="academy-hero-copy landing-reveal">
          <p className="landing-announcement"><span />{copy.announcement}</p>
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h1 id="hero-title">{copy.title}</h1>
          <p className="academy-hero-description">{copy.description}</p>
          <div className="landing-actions">
            <Link href="/student/discover" className="academy-button academy-button-gold">
              {copy.primary}<ArrowIcon mirrored={isAr} />
            </Link>
            <Link href="/become-teacher" className="academy-button academy-button-outline">
              {copy.secondary}
            </Link>
          </div>
          <dl className="academy-metrics">
            {copy.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="teacher-constellation landing-reveal landing-delay-2" aria-label={copy.constellation.label}>
          <div className="constellation-heading">
            <span>{copy.constellation.label}</span>
            <i aria-hidden="true" />
          </div>
          <div className="constellation-stage">
            {[0, 1, 2].map((index) => {
              const tutor = visibleTutors[index];
              const fallback = FALLBACK_TUTORS[index];
              const tutorName = tutor ? `${tutor.user.firstName} ${tutor.user.lastName}` : fallback.name;
              const tutorSubject = tutor?.specialization || fallback.subject;
              return (
                <article key={tutor?.userId ?? fallback.name} className={`constellation-card constellation-card-${index + 1}`}>
                  <div className={`constellation-portrait portrait-${fallback.tone}`}>
                    {tutor ? <TutorPortrait tutor={tutor} /> : <InitialsAvatar name={fallback.initials} />}
                  </div>
                  <div>
                    <h2>{tutorName}</h2>
                    <p>{tutorSubject}</p>
                  </div>
                </article>
              );
            })}
            <span className="constellation-rating"><b>★</b> {copy.constellation.rating}</span>
            <span className="constellation-availability"><i />{copy.constellation.availability}</span>
            <span className="constellation-orbit orbit-one" aria-hidden="true" />
            <span className="constellation-orbit orbit-two" aria-hidden="true" />
          </div>
          <div className="constellation-footer"><span>MR.H</span><span>ACADEMY / 2026</span></div>
        </div>
      </div>
    </section>
  );
}

function DiscoverySection({ copy, lang }: { copy: Copy; lang: Language }) {
  return (
    <section className="landing-section discovery-section" aria-labelledby="discovery-title">
      <div className="landing-shell discovery-layout">
        <div>
          <SectionIntro eyebrow={copy.discovery.eyebrow} title={copy.discovery.title} description={copy.discovery.description} />
          <Link href="/student/discover" className="landing-text-link">
            {lang === 'ar' ? 'استكشف جميع اللغات' : 'Explore every language'} <ArrowIcon mirrored={lang === 'ar'} />
          </Link>
        </div>
        <div className="language-ledger">
          {copy.discovery.languages.map((language, index) => (
            <Link key={language.name} href={`/student/discover?languages=${encodeURIComponent(language.query)}`} className="language-row">
              <span className="language-index">0{index + 1}</span>
              <span className="language-name"><strong>{language.name}</strong><small>{language.native}</small></span>
              <span className="language-note">{language.note}</span>
              <ArrowIcon mirrored={lang === 'ar'} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TutorCard({ tutor, copy }: { tutor: TutorProfile; copy: Copy }) {
  const name = `${tutor.user.firstName} ${tutor.user.lastName}`;

  return (
    <Link href={`/tutors/${tutor.userId}`} className="academy-tutor-card">
      <div className="tutor-card-portrait"><TutorPortrait tutor={tutor} /></div>
      <div className="tutor-card-body">
        <div className="tutor-card-heading">
          <div><h3>{name}</h3><p>{tutor.specialization}</p></div>
          {tutor.averageRating !== undefined && <span>★ {tutor.averageRating.toFixed(1)}</span>}
        </div>
        <p className="tutor-card-bio">{tutor.bio}</p>
        <div className="tutor-language-list">
          {tutor.languages?.slice(0, 3).map((language) => <span key={language}>{language}</span>)}
        </div>
        <div className="tutor-card-footer">
          <strong>${tutor.hourlyRate}<small>{copy.tutors.hour}</small></strong>
          <span>{tutor.reviewCount ?? 0} {copy.tutors.reviews}</span>
        </div>
      </div>
    </Link>
  );
}

function TutorsSection({ copy, tutors, isLoading }: { copy: Copy; tutors: TutorProfile[]; isLoading: boolean }) {
  return (
    <section className="landing-section tutors-section" aria-labelledby="tutors-title">
      <div className="landing-shell">
        <div className="tutors-heading-row">
          <SectionIntro eyebrow={copy.tutors.eyebrow} title={copy.tutors.title} description={copy.tutors.description} />
          <Link href="/student/discover" className="landing-text-link">{copy.tutors.all}<ArrowIcon /></Link>
        </div>
        {isLoading ? (
          <div className="tutor-loading" role="status"><span /><span /><span /><p>{copy.tutors.loading}</p></div>
        ) : tutors.length > 0 ? (
          <div className="tutor-card-grid">{tutors.slice(0, 3).map((tutor) => <TutorCard key={tutor.userId} tutor={tutor} copy={copy} />)}</div>
        ) : (
          <div className="tutors-empty">
            <div className="empty-portrait-stack" aria-hidden="true"><InitialsAvatar name="MA" /><InitialsAvatar name="SK" /><InitialsAvatar name="OY" /></div>
            <div><h3>{copy.tutors.emptyTitle}</h3><p>{copy.tutors.emptyCopy}</p></div>
            <Link href="/student/discover" className="academy-button academy-button-dark">{copy.tutors.all}<ArrowIcon /></Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ProcessSection({ copy }: { copy: Copy }) {
  return (
    <section className="landing-section process-section" aria-labelledby="process-title">
      <div className="landing-shell process-layout">
        <div>
          <SectionIntro eyebrow={copy.process.eyebrow} title={copy.process.title} description={copy.process.description} />
          <div className="process-assurance">
            <span className="academy-crest academy-crest-light" aria-hidden="true"><b>H</b><small>ACADEMY</small></span>
            <div><h3>{copy.process.assurance}</h3><p>{copy.process.assuranceCopy}</p></div>
          </div>
        </div>
        <ol className="process-list">
          {copy.process.steps.map((step) => (
            <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CTASection({ copy }: { copy: Copy }) {
  return (
    <section className="landing-cta-section">
      <div className="landing-shell">
        <div className="landing-cta-band">
          <div><p className="landing-eyebrow landing-eyebrow-dark">{copy.cta.eyebrow}</p><h2>{copy.cta.title}</h2><p>{copy.cta.description}</p></div>
          <div className="landing-actions">
            <Link href="/register" className="academy-button academy-button-dark">{copy.cta.primary}<ArrowIcon /></Link>
            <Link href="/student/discover" className="academy-button academy-button-green-outline">{copy.cta.secondary}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ lang }: { lang: Language }) {
  const { setLanguage } = useLanguage();
  const copy = COPY[lang];
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ['top-tutors-homepage'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>('/tutors/top');
      return data;
    },
  });

  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  return (
    <div className="academy-landing min-h-screen">
      <Navbar language={lang} />
      <main>
        <Hero copy={copy} tutors={tutors} lang={lang} />
        <DiscoverySection copy={copy} lang={lang} />
        <TutorsSection copy={copy} tutors={tutors} isLoading={isLoading} />
        <ProcessSection copy={copy} />
        <CTASection copy={copy} />
      </main>
      <Footer language={lang} />
    </div>
  );
}
