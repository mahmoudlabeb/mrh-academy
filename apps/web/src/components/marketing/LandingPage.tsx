"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";
import { useLanguage } from "@/contexts/language-context";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";

type Language = "ar" | "en";

type Tutor = {
  userId: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  averageRating?: number;
  reviewCount?: number;
  bio?: string;
  verified?: boolean;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
};

type Course = {
  id: string;
  title: string;
  price: number;
  thumbnailUrl?: string;
  tutor: { firstName: string; lastName: string };
};

const FALLBACK_TUTORS: Tutor[] = [
  {
    userId: "fallback-1",
    specialization: "English Tutor",
    languages: ["English", "Conversation", "Kids"],
    hourlyRate: 15,
    averageRating: 4.9,
    reviewCount: 28,
    verified: true,
    bio: "Certified English tutor with 5 years of experience helping students succeed.",
    user: { firstName: "Sarah", lastName: "Ahmed" },
  },
  {
    userId: "fallback-2",
    specialization: "English Tutor",
    languages: ["Conversation", "Business", "Grammar"],
    hourlyRate: 15,
    averageRating: 4.8,
    reviewCount: 34,
    verified: true,
    bio: "Experienced English tutor helping students achieve fluency and confidence.",
    user: { firstName: "Omar", lastName: "Khaled" },
  },
  {
    userId: "fallback-3",
    specialization: "Arabic Tutor",
    languages: ["Beginners", "Conversation", "Kids"],
    hourlyRate: 12,
    averageRating: 4.9,
    reviewCount: 19,
    verified: true,
    bio: "Native Arabic speaker specialising in Modern Standard Arabic and dialects.",
    user: { firstName: "Yasmeen", lastName: "Ayman" },
  },
];

const FALLBACK_COURSES: Course[] = [
  {
    id: "fallback-english-foundations",
    title: "English Foundations",
    price: 49,
    tutor: { firstName: "Sarah", lastName: "Ahmed" },
  },
  {
    id: "fallback-arabic-conversation",
    title: "Arabic Conversation",
    price: 39,
    tutor: { firstName: "Yasmeen", lastName: "Ayman" },
  },
  {
    id: "fallback-business-english",
    title: "Business English Essentials",
    price: 59,
    tutor: { firstName: "Omar", lastName: "Khaled" },
  },
];

const COPY = {
  en: {
    badge: "First in the Arab World 🏆",
    titleLead: "Unlock your potential with the best",
    titleAccent: "language tutors",
    intro:
      "Learn English and Arabic through live classes with professional tutors from all over the world.",
    tutorCardName: "Ahmed K.",
    tutorCardRole: "English Tutor",
    nextLesson: "Next Lesson",
    nextLessonTime: "Today, 5:00 PM",
    languages: "Languages you can learn",
    english: "English",
    arabic: "Arabic",
    findTutors: "Find Tutors",
    tutorsTitle: "Excellent tutors ready to help you",
    tutorsIntro:
      "Choose the most suitable tutor from our elite certified teachers.",
    allTutors: "View All Tutors",
    noTutors: "Approved tutor profiles will appear here when available.",
    perLesson: "/ 50 min",
    book: "Book a lesson",
    coursesTitle: "Courses you can start today",
    coursesIntro: "Learn independently without losing the MRH standard.",
    allCourses: "View All Courses",
    noCourses: "Approved courses will appear here when available.",
    ready: "Ready to start your learning journey?",
    readyBody:
      "Join learners who achieve their language goals every day with Mr.H Academy.",
    findNow: "Find a tutor now",
    becomeTutor: "Become a tutor with us",
  },
  ar: {
    badge: "الأول في العالم العربي 🏆",
    titleLead: "أطلق العنان لقدراتك مع أفضل",
    titleAccent: "مدرّسي اللغات",
    intro:
      "تعلّم الإنجليزية والعربية عبر دروس مباشرة مع مدرّسين محترفين من جميع أنحاء العالم.",
    tutorCardName: "أحمد ك.",
    tutorCardRole: "مدرّس لغة إنجليزية",
    nextLesson: "الدرس القادم",
    nextLessonTime: "اليوم، 5:00 مساءً",
    languages: "لغات يمكنك تعلّمها",
    english: "إنجليزي",
    arabic: "عربي",
    findTutors: "ابحث عن مدرّس",
    tutorsTitle: "مدرّسون متميزون مستعدون لمساعدتك",
    tutorsIntro: "اختر المدرّس الأنسب لك من نخبة المدرّسين المعتمدين.",
    allTutors: "عرض جميع المدرّسين",
    noTutors: "ستظهر هنا ملفات المدرّسين المعتمدين عند توافرها.",
    perLesson: "/ 50 دقيقة",
    book: "احجز درسًا",
    coursesTitle: "دورات يمكنك أن تبدأها اليوم",
    coursesIntro: "تعلّم باستقلالية مع الحفاظ على معيار أكاديمية MRH.",
    allCourses: "عرض جميع الدورات",
    noCourses: "ستظهر هنا الدورات المعتمدة عند توافرها.",
    ready: "جاهز للبدء في رحلتك التعليمية؟",
    readyBody:
      "انضم إلى متعلّمين يحققون أهدافهم اللغوية يوميًا مع أكاديمية Mr.H.",
    findNow: "ابحث عن مدرّس الآن",
    becomeTutor: "كن مدرّسًا معنا",
  },
} satisfies Record<Language, Record<string, string>>;

const referencePortraits = [
  "/reference-assets/tutor_1.png",
  "/reference-assets/tutor_2.png",
] as const;

export default function LandingPage({ lang }: { lang: Language }) {
  const { setLanguage } = useLanguage();
  const copy = COPY[lang];
  const base = `/${lang}`;

  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  const tutors = useQuery({
    queryKey: ["home-approved-tutors"],
    queryFn: async () => (await apiClient.get<Tutor[]>("/tutors/top")).data,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const courses = useQuery({
    queryKey: ["home-approved-courses"],
    queryFn: async () => (await apiClient.get<Course[]>("/courses")).data,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const tutorItems = tutors.data?.length ? tutors.data : FALLBACK_TUTORS;
  const courseItems = courses.data?.length ? courses.data : FALLBACK_COURSES;
  const tutorsArePreview = !tutors.data?.length;
  const coursesArePreview = !courses.data?.length;

  return (
    <div
      className="academy-landing"
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <a className="skip-link" href="#main-content">
        {lang === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      <Navbar language={lang} />

      <main id="main-content">
        <section className="reference-hero" aria-labelledby="home-title">
          <div className="reference-container reference-hero-grid">
            <div className="reference-hero-copy">
              <p className="reference-badge">{copy.badge}</p>
              <h1 id="home-title">
                {copy.titleLead} <span>{copy.titleAccent}</span>
              </h1>
              <p>{copy.intro}</p>
            </div>

            <div className="reference-hero-art">
              <Image
                src="/reference-assets/hero.png"
                alt={
                  lang === "ar"
                    ? "طلاب من ثقافات مختلفة يتعلّمون اللغات معًا"
                    : "Learners from different cultures studying languages together"
                }
                width={800}
                height={800}
                priority
                sizes="(max-width: 992px) 78vw, 400px"
              />
              <div className="reference-float-card reference-float-tutor">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{copy.tutorCardName}</strong>
                  <small>{copy.tutorCardRole}</small>
                </div>
              </div>
              <div className="reference-float-card reference-float-lesson">
                <strong>{copy.nextLesson}</strong>
                <small>{copy.nextLessonTime}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="reference-languages" aria-labelledby="languages-title">
          <div className="reference-container">
            <h2 id="languages-title">{copy.languages}</h2>
            <div className="reference-language-grid">
              <Link
                href={`${base}/tutors?language=English`}
                className="reference-language-card reference-language-english"
              >
                <span>{copy.english}</span>
                <strong>
                  {copy.findTutors} <DirectionalArrow />
                </strong>
                <i aria-hidden="true">EN</i>
              </Link>
              <Link
                href={`${base}/tutors?language=Arabic`}
                className="reference-language-card reference-language-arabic"
              >
                <span>{copy.arabic}</span>
                <strong>
                  {copy.findTutors} <DirectionalArrow />
                </strong>
                <i aria-hidden="true">AR</i>
              </Link>
            </div>
          </div>
        </section>

        <section className="reference-tutors" aria-labelledby="home-tutors">
          <div className="reference-container">
            <header className="reference-section-heading">
              <h2 id="home-tutors">{copy.tutorsTitle}</h2>
              <p>{copy.tutorsIntro}</p>
            </header>

            <div
              className="reference-tutor-list"
              aria-busy={tutors.isLoading}
            >
                {tutorItems.slice(0, 3).map((tutor, index) => {
                  const isPreview = tutorsArePreview;
                  const tutorHref = isPreview
                    ? `${base}/tutors`
                    : `${base}/tutors/${tutor.userId}`;
                  const bookingHref = isPreview
                    ? `${base}/tutors`
                    : `${base}/tutors/${tutor.userId}/book`;
                  return (
                  <article className="reference-tutor-card" key={tutor.userId}>
                    <div className="reference-tutor-content">
                      <header>
                        <Image
                          src={
                            tutor.user.avatarUrl ??
                            referencePortraits[index % referencePortraits.length]
                          }
                          alt=""
                          width={62}
                          height={62}
                        />
                        <div>
                          <h3>
                            {tutor.user.firstName} {tutor.user.lastName}
                            {tutor.verified && (
                              <span className="reference-verified" aria-label="Verified tutor">
                                ✓
                              </span>
                            )}
                          </h3>
                          <p>{tutor.specialization}</p>
                          {typeof tutor.averageRating === "number" && (
                            <span className="reference-rating">
                              ★ {tutor.averageRating.toFixed(1)}
                              {typeof tutor.reviewCount === "number"
                                ? ` (${tutor.reviewCount})`
                              : ""}
                            </span>
                          )}
                        </div>
                      </header>
                      <p className="reference-tutor-bio">
                        {tutor.bio ??
                          (lang === "ar"
                            ? "مدرّس معتمد يساعدك على التعلّم بثقة."
                            : "An approved tutor ready to help you learn with confidence.")}
                      </p>
                      <div className="reference-tutor-tags">
                        {tutor.languages.map((language) => (
                          <span key={language}>{language}</span>
                        ))}
                      </div>
                      <footer>
                        <strong>
                          <bdi>{formatCurrency(lang, tutor.hourlyRate)}</bdi>{" "}
                          <small>{copy.perLesson}</small>
                        </strong>
                        <Link href={bookingHref}>
                          {copy.book}
                        </Link>
                      </footer>
                    </div>
                    <Link
                      className="reference-tutor-video"
                      href={tutorHref}
                      aria-label={`${tutor.user.firstName} ${tutor.user.lastName}`}
                    >
                      <Image
                        src="/reference-assets/hero.png"
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 280px"
                      />
                      <span aria-hidden="true">▶</span>
                    </Link>
                  </article>
                  );
                })}
            </div>
            {tutorsArePreview && (
              <p className="reference-data-note" role="status">
                {tutors.isError
                  ? copy.noTutors
                  : lang === "ar"
                    ? "ملفات استكشافية أثناء تحميل أحدث المعلّمين."
                    : "Showing preview profiles while the latest tutors load."}
              </p>
            )}

            <div className="reference-view-all">
              <Link href={`${base}/tutors`}>{copy.allTutors}</Link>
            </div>
          </div>
        </section>

        <section className="reference-courses" aria-labelledby="home-courses">
          <div className="reference-container">
            <header className="reference-section-heading">
              <h2 id="home-courses">{copy.coursesTitle}</h2>
              <p>{copy.coursesIntro}</p>
            </header>
            <div
              className="reference-course-grid"
              aria-busy={courses.isLoading}
            >
                {courseItems.slice(0, 3).map((course) => {
                  const isPreview = coursesArePreview;
                  return (
                  <Link
                    href={
                      isPreview ? `${base}/courses` : `${base}/courses/${course.id}`
                    }
                    className="reference-course-card"
                    key={course.id}
                  >
                    <span className="reference-course-image">
                      <Image
                        src={
                          course.thumbnailUrl ?? "/reference-assets/hero.png"
                        }
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </span>
                    <span>
                      <strong>{course.title}</strong>
                      <small>
                        {course.tutor.firstName} {course.tutor.lastName}
                      </small>
                    </span>
                    <bdi>{formatCurrency(lang, course.price)}</bdi>
                  </Link>
                  );
                })}
            </div>
            {coursesArePreview && (
              <p className="reference-data-note" role="status">
                {courses.isError
                  ? copy.noCourses
                  : lang === "ar"
                    ? "دورات استكشافية أثناء تحميل أحدث الدورات."
                    : "Showing preview courses while the latest catalog loads."}
              </p>
            )}
            <div className="reference-view-all">
              <Link href={`${base}/courses`}>{copy.allCourses}</Link>
            </div>
          </div>
        </section>

        <section className="reference-cta">
          <div className="reference-container">
            <h2>{copy.ready}</h2>
            <p>{copy.readyBody}</p>
            <div>
              <Link href={`${base}/tutors`}>{copy.findNow}</Link>
              <Link href={`${base}/become-a-tutor`}>{copy.becomeTutor}</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer language={lang} />
    </div>
  );
}
