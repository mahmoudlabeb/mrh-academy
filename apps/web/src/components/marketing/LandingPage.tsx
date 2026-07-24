"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";

type Language = "ar" | "en";

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
    announcement: "نستقبل الآن طلبات المعلمين الجدد",
    eyebrow: "تعليم شخصي • خبرة عالمية",
    title: (
      <>
        أتقن أي لغة مع <em>معلمين خبراء</em> من جميع أنحاء العالم
      </>
    ),
    description:
      "تواصل مع معلمين لغات معتمدين، واحجز جلسات فردية، وابدأ رحلة تعلّم مصممة خصيصًا لك.",
    primary: "ابحث عن معلم",
    secondary: "كن معلمًا",
    stats: [
      { value: "200+", label: "معلم متخصص" },
      { value: "12+", label: "لغة متاحة" },
      { value: "5K+", label: "طالب يتعلّم" },
      { value: "4.8", label: "متوسط التقييم" },
    ],
    constellation: {
      label: "معلمون يطابقون هدفك",
      rating: "4.9 تقييم",
      availability: "مواعيد هذا الأسبوع",
    },
    discovery: {
      eyebrow: "اختر مسارك",
      title: "اختر اللغة التي تريد إتقانها",
      description: "ابدأ مسارك مع معلم يتحدث لغتك ويفهم هدفك.",
      languages: [
        {
          name: "English",
          native: "الإنجليزية",
          note: "للعمل والدراسة والسفر",
          query: "English",
        },
        {
          name: "العربية",
          native: "Arabic",
          note: "للتواصل والثقافة والطلاقة",
          query: "العربية",
        },
        {
          name: "Deutsch",
          native: "الألمانية",
          note: "لمسارك الأكاديمي والمهني",
          query: "German",
        },
        {
          name: "Français",
          native: "الفرنسية",
          note: "للمحادثة والاختبارات",
          query: "French",
        },
      ],
    },
    tutors: {
      eyebrow: "نخبة الأكاديمية",
      title: "معلمون يصنعون فرقًا حقيقيًا",
      description:
        "خبرات موثقة، أساليب متنوعة، وتقييمات تساعدك على الاختيار بثقة.",
      all: "عرض كل المعلمين",
      loading: "نبحث لك عن أفضل المعلمين…",
      emptyTitle: "معلمك المناسب بانتظارك",
      emptyCopy: "استكشف قائمة المعلمين وحدد اللغة والموعد المناسبين لك.",
      hour: "/ ساعة",
      reviews: "مراجعة",
    },
    process: {
      eyebrow: "رحلة واضحة",
      title: "من هدفك إلى محادثتك الأولى",
      description: "كل خطوة مصممة لتمنحك قرارًا أسهل وتعلّمًا أكثر تركيزًا.",
      steps: [
        {
          number: "01",
          title: "حدّد ما تريد",
          description: "اختر اللغة وهدفك ووقتك المتاح.",
        },
        {
          number: "02",
          title: "قابل معلمك",
          description: "قارن الملفات والتقييمات والأسعار بوضوح.",
        },
        {
          number: "03",
          title: "ابدأ وتقدّم",
          description: "احجز جلسة مباشرة وتابع تطورك خطوة بخطوة.",
        },
      ],
      assurance: "ثقة في كل جلسة",
      assuranceCopy:
        "ملفات معلمين واضحة، تقييمات طلاب، مواعيد مرنة، وتجربة حجز منظمة من مكان واحد.",
    },
    cta: {
      eyebrow: "خطوتك الأولى قريبة",
      title: "ابدأ رحلة تعلّم تليق بطموحك",
      description:
        "أنشئ حسابك واكتشف المعلم الذي يفهم هدفك وطريقتك في التعلّم.",
      primary: "ابدأ الآن",
      secondary: "تصفّح المعلمين",
    },
  },
  en: {
    announcement: "Now welcoming new tutor applications",
    eyebrow: "Personal learning • Global expertise",
    title: (
      <>
        Master any language with <em>expert tutors</em> from around the world
      </>
    ),
    description:
      "Connect with certified language tutors, book one-to-one sessions, and begin a learning journey made for you.",
    primary: "Find a tutor",
    secondary: "Become a tutor",
    stats: [
      { value: "200+", label: "Specialist tutors" },
      { value: "12+", label: "Languages" },
      { value: "5K+", label: "Active learners" },
      { value: "4.8", label: "Average rating" },
    ],
    constellation: {
      label: "Tutors matched to your goal",
      rating: "4.9 rating",
      availability: "Open this week",
    },
    discovery: {
      eyebrow: "Choose your path",
      title: "Choose the language you want to master",
      description:
        "Start your path with a tutor who speaks your language and understands your goal.",
      languages: [
        {
          name: "English",
          native: "الإنجليزية",
          note: "For work, study, and travel",
          query: "English",
        },
        {
          name: "العربية",
          native: "Arabic",
          note: "For culture, connection, and fluency",
          query: "العربية",
        },
        {
          name: "Deutsch",
          native: "German",
          note: "For academic and career goals",
          query: "German",
        },
        {
          name: "Français",
          native: "French",
          note: "For conversation and exams",
          query: "French",
        },
      ],
    },
    tutors: {
      eyebrow: "Academy selection",
      title: "Tutors who make progress personal",
      description:
        "Verified expertise, distinct teaching styles, and reviews that help you choose well.",
      all: "View all tutors",
      loading: "Finding our best tutors for you…",
      emptyTitle: "Your ideal tutor is waiting",
      emptyCopy:
        "Explore our tutors, then choose the language and time that suit you.",
      hour: "/ hour",
      reviews: "reviews",
    },
    process: {
      eyebrow: "A clear journey",
      title: "From your goal to your first conversation",
      description:
        "Every step is designed to make choosing easier and learning more focused.",
      steps: [
        {
          number: "01",
          title: "Define your goal",
          description: "Choose your language, outcome, and available time.",
        },
        {
          number: "02",
          title: "Meet your match",
          description: "Compare profiles, reviews, pricing, and style.",
        },
        {
          number: "03",
          title: "Learn and progress",
          description: "Book a live lesson and build momentum every week.",
        },
      ],
      assurance: "Confidence in every lesson",
      assuranceCopy:
        "Clear tutor profiles, learner reviews, flexible times, and an organized booking experience in one place.",
    },
    cta: {
      eyebrow: "Your first step is close",
      title: "Begin a learning journey worthy of your ambition",
      description:
        "Create your account and find a tutor who understands your goals and how you learn.",
      primary: "Start now",
      secondary: "Browse tutors",
    },
  },
};

function ArrowIcon({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      className={mirrored ? "landing-arrow mirrored" : "landing-arrow"}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10h12m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FEATURE_COPY: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    description: string;
    items: { title: string; description: string }[];
  }
> = {
  ar: {
    eyebrow: "منصة متكاملة",
    title: "كل ما تحتاجه للنجاح",
    description: "تجربة تعلّم آمنة ومنظمة، من اختيار المعلم حتى متابعة تقدّمك.",
    items: [
      {
        title: "تسجيل آمن",
        description:
          "نظام متقدم لحماية حسابك وتسجيل دخول آمن عبر البريد الإلكتروني أو Google.",
      },
      {
        title: "محرك بحث ذكي",
        description:
          "تصفّح مئات المعلمين المعتمدين حسب اللغة والسعر والتقييمات.",
      },
      {
        title: "جدولة ذكية",
        description: "نظام تقويم تفاعلي مع مواعيد مرنة وتذكيرات تلقائية.",
      },
      {
        title: "تقييمات ومراجعات",
        description: "تقييمات مفصلة من الطلاب الموثوقين تساعدك على الاختيار.",
      },
      {
        title: "إدارة وإشراف",
        description:
          "فريق دعم يتابع طلبات المعلمين ويضمن جودة التجربة التعليمية.",
      },
      {
        title: "تدريب المعلمين",
        description: "موارد ودورات متخصصة تساعد المعلمين على تطوير مهاراتهم.",
      },
    ],
  },
  en: {
    eyebrow: "One complete platform",
    title: "Everything you need to succeed",
    description:
      "A safe, organized learning experience from choosing a tutor to tracking your progress.",
    items: [
      {
        title: "Secure signup",
        description:
          "Advanced account protection with secure email and Google sign-in.",
      },
      {
        title: "Smart tutor search",
        description:
          "Explore verified tutors by language, price, availability, and ratings.",
      },
      {
        title: "Flexible scheduling",
        description:
          "An interactive calendar with flexible times and automatic reminders.",
      },
      {
        title: "Ratings and reviews",
        description:
          "Detailed feedback from verified learners helps you choose confidently.",
      },
      {
        title: "Active supervision",
        description:
          "A support team reviews tutors and protects the quality of every experience.",
      },
      {
        title: "Tutor training",
        description:
          "Specialized resources and courses help every tutor teach at their best.",
      },
    ],
  },
};

function FeatureIcon({ index }: { index: number }) {
  const paths = [
    <path
      key="shield"
      d="M12 3.5 5.5 6v4.8c0 4.2 2.6 7.9 6.5 9.7 3.9-1.8 6.5-5.5 6.5-9.7V6L12 3.5Zm-2.6 8.3 1.7 1.7 3.7-4"
    />,
    <path
      key="search"
      d="m19 19-4.3-4.3m2.3-4.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
    />,
    <path key="calendar" d="M5 5.5h14v14H5v-14Zm3-2v4m8-4v4M5 9.5h14" />,
    <path
      key="star"
      d="m12 3.8 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 19l.9-5.5-4-3.9 5.5-.8 2.5-5Z"
    />,
    <path
      key="people"
      d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19v-1.2c0-2.3 2.2-4.3 5-4.3s5 2 5 4.3V19h-10Zm10.2-5.2c2.9-.6 5.3 1.2 5.3 3.6V19"
    />,
    <path
      key="academy"
      d="m4 8 8-4 8 4-8 4-8-4Zm3 2.2v5.2c2.7 2.1 7.3 2.1 10 0v-5.2M20 8v6"
    />,
  ];

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[index]}
      </g>
    </svg>
  );
}

function InitialsAvatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className={`initials-avatar ${className}`}>{initials || "MH"}</span>
  );
}

function TutorPortrait({
  tutor,
  className = "",
}: {
  tutor?: TutorProfile;
  className?: string;
}) {
  const name = tutor
    ? `${tutor.user.firstName} ${tutor.user.lastName}`
    : "Mr.H Tutor";

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

function SectionIntro({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id?: string;
}) {
  return (
    <header className="landing-section-intro">
      <p className="landing-eyebrow landing-eyebrow-dark">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="landing-section-copy">{description}</p>
    </header>
  );
}

function Hero({ copy, lang }: { copy: Copy; lang: Language }) {
  const isAr = lang === "ar";

  return (
    <section className="academy-hero" aria-labelledby="hero-title">
      <div className="academy-hero-atmosphere" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="landing-shell academy-hero-layout landing-reveal">
        <div className="academy-hero-copy">
          <p className="landing-announcement">
            <span />
            {copy.announcement}
          </p>
          <h1 id="hero-title">{copy.title}</h1>
          <p className="academy-hero-description">{copy.description}</p>
          <div className="landing-actions">
            <Link
              href="/student/discover"
              className="academy-button academy-button-gold"
            >
              {copy.primary}
              <ArrowIcon mirrored={isAr} />
            </Link>
            <Link
              href="/become-teacher"
              className="academy-button academy-button-outline"
            >
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
      </div>
    </section>
  );
}

function DiscoverySection({ copy, lang }: { copy: Copy; lang: Language }) {
  return (
    <section
      className="landing-section discovery-section"
      aria-labelledby="discovery-title"
    >
      <div className="landing-shell">
        <header className="language-section-heading">
          <p className="landing-eyebrow">{copy.discovery.eyebrow}</p>
          <h2 id="discovery-title">{copy.discovery.title}</h2>
          <p>{copy.discovery.description}</p>
        </header>
        <div className="language-choice-grid">
          {copy.discovery.languages.slice(0, 2).map((language, index) => (
            <Link
              key={language.name}
              href={`/student/discover?languages=${encodeURIComponent(language.query)}`}
              className={`language-choice-card language-choice-card-${index + 1}`}
            >
              <span className="language-card-orbit" aria-hidden="true" />
              <span className="language-card-code">0{index + 1}</span>
              <span className="language-card-content">
                <strong>{language.name}</strong>
                <small>{language.native}</small>
                <span>{language.note}</span>
              </span>
              <span className="language-card-link">
                {lang === "ar" ? "تصفح المعلمين" : "Explore tutors"}
                <ArrowIcon mirrored={lang === "ar"} />
              </span>
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
      <div className="tutor-card-portrait">
        <TutorPortrait tutor={tutor} />
      </div>
      <div className="tutor-card-body">
        <h3>{name}</h3>
        <p>{tutor.specialization}</p>
        <div className="tutor-card-footer">
          <span>
            {tutor.averageRating !== undefined
              ? `★ ${tutor.averageRating.toFixed(1)}`
              : copy.tutors.emptyTitle}
          </span>
          <strong>
            ${tutor.hourlyRate}
            <small>{copy.tutors.hour}</small>
          </strong>
        </div>
      </div>
    </Link>
  );
}

function TutorsSection({
  copy,
  tutors,
  isLoading,
  sectionRef,
}: {
  copy: Copy;
  tutors: TutorProfile[];
  isLoading: boolean;
  sectionRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={sectionRef}
      className="tutors-section"
      aria-labelledby="tutors-title"
    >
      <div className="landing-shell">
        <div className="tutors-heading-row">
          <SectionIntro
            id="tutors-title"
            eyebrow={copy.tutors.eyebrow}
            title={copy.tutors.title}
            description={copy.tutors.description}
          />
          <Link href="/student/discover" className="landing-text-link">
            {copy.tutors.all}
            <ArrowIcon />
          </Link>
        </div>
        {isLoading ? (
          <div className="tutor-loading" role="status">
            <span />
            <span />
            <span />
            <p>{copy.tutors.loading}</p>
          </div>
        ) : tutors.length > 0 ? (
          <div className="tutor-card-grid">
            {tutors.slice(0, 3).map((tutor) => (
              <TutorCard key={tutor.userId} tutor={tutor} copy={copy} />
            ))}
          </div>
        ) : (
          <div className="tutors-empty">
            <div className="empty-portrait-stack" aria-hidden="true">
              <InitialsAvatar name="MA" />
              <InitialsAvatar name="SK" />
              <InitialsAvatar name="OY" />
            </div>
            <div>
              <h3>{copy.tutors.emptyTitle}</h3>
              <p>{copy.tutors.emptyCopy}</p>
            </div>
            <Link href="/student/discover" className="landing-text-link">
              {copy.tutors.all}
              <ArrowIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturesSection({ lang }: { lang: Language }) {
  const copy = FEATURE_COPY[lang];

  return (
    <section
      className="landing-section features-section"
      aria-labelledby="features-title"
    >
      <div className="landing-shell">
        <header className="features-heading">
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h2 id="features-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </header>
        <div className="feature-grid">
          {copy.items.map((item, index) => (
            <article className="feature-card" key={item.title}>
              <span className="feature-icon">
                <FeatureIcon index={index} />
              </span>
              <span className="feature-number">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ copy, lang }: { copy: Copy; lang: Language }) {
  return (
    <section className="landing-cta-section">
      <div className="landing-shell">
        <div className="landing-cta-band">
          <div>
            <p className="landing-eyebrow landing-eyebrow-dark">
              {copy.cta.eyebrow}
            </p>
            <h2>{copy.cta.title}</h2>
            <p>{copy.cta.description}</p>
          </div>
          <div className="landing-actions">
            <Link
              href="/student/discover"
              className="academy-button academy-button-dark"
            >
              {copy.cta.secondary}
              <ArrowIcon />
            </Link>
            <Link
              href="/become-teacher"
              className="academy-button academy-button-green-outline"
            >
              {lang === "ar" ? "كن معلمًا" : "Become a tutor"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ lang }: { lang: Language }) {
  const { setLanguage } = useLanguage();
  const copy = COPY[lang];
  const tutorsSectionRef = useRef<HTMLElement>(null);
  const [shouldLoadTutors, setShouldLoadTutors] = useState(false);
  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["top-tutors-homepage"],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>("/tutors/top");
      return data;
    },
    enabled: shouldLoadTutors,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  useEffect(() => {
    const section = tutorsSectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setShouldLoadTutors(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoadTutors(true);
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="academy-landing min-h-screen">
      <Navbar language={lang} />
      <main>
        <Hero copy={copy} lang={lang} />
        <DiscoverySection copy={copy} lang={lang} />
        <FeaturesSection lang={lang} />
        <TutorsSection
          copy={copy}
          tutors={tutors}
          isLoading={!shouldLoadTutors || isLoading}
          sectionRef={tutorsSectionRef}
        />
        <CTASection copy={copy} lang={lang} />
      </main>
      <Footer language={lang} />
    </div>
  );
}
