"use client";

import Image from "next/image";
import Link from "next/link";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
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

const COPY = {
  en: {
    kicker: "Two ways to learn. One thoughtful academy.",
    title: "Learn live. Or learn on your own time.",
    intro:
      "Meet an expert in MRH’s native classroom, or begin a protected self-paced course today. You choose the rhythm; we keep the path clear.",
    find: "Find a tutor",
    findNote: "Request a private 25 or 50 minute lesson.",
    courses: "Browse courses",
    coursesNote: "Learn through protected lessons at your pace.",
    promise: "The room belongs to the lesson.",
    promiseBody:
      "Camera, microphone, screen sharing, whiteboard, books, and chat live inside MRH. Google Meet is available only when your lesson provides it as a fallback.",
    tutorsTitle: "Tutors on MRH",
    coursesTitle: "Courses you can start today",
    allTutors: "See all tutors",
    allCourses: "See all courses",
    noTutors: "Approved tutor profiles will appear here when available.",
    noCourses: "Approved courses will appear here when available.",
    liveHow: "How a live lesson works",
    courseHow: "How a course works",
    liveSteps: [
      "Choose a tutor",
      "Request a time",
      "Your tutor confirms",
      "Meet in the MRH classroom",
    ],
    courseSteps: [
      "Choose a course",
      "Enrol",
      "Watch and learn",
      "Mark lessons complete",
    ],
    charge: "You are charged only when your tutor confirms.",
    teach: "Teach on MRH",
    corporate: "Training for teams",
    hour: "per hour",
  },
  ar: {
    kicker: "طريقتان للتعلّم. أكاديمية واحدة بعناية كاملة.",
    title: "تعلّم مباشرةً. أو تعلّم في وقتك.",
    intro:
      "التقِ بخبير داخل فصل MRH المباشر، أو ابدأ دورة محمية تتعلّم منها وفق سرعتك. أنت تختار الإيقاع، ونحن نوضّح الطريق.",
    find: "ابحث عن معلّم",
    findNote: "اطلب درسًا فرديًا لمدة 25 أو 50 دقيقة.",
    courses: "تصفّح الدورات",
    coursesNote: "تعلّم من دروس محمية وفق وقتك.",
    promise: "الفصل جزء من الدرس.",
    promiseBody:
      "الكاميرا والميكروفون ومشاركة الشاشة والسبورة والكتب والمحادثة كلها داخل MRH. يظهر Google Meet فقط كرابط احتياطي عندما يوفّره الدرس.",
    tutorsTitle: "معلّمون على MRH",
    coursesTitle: "دورات يمكنك أن تبدأها اليوم",
    allTutors: "عرض كل المعلّمين",
    allCourses: "عرض كل الدورات",
    noTutors: "ستظهر هنا ملفات المعلّمين المعتمدين عند توافرها.",
    noCourses: "ستظهر هنا الدورات المعتمدة عند توافرها.",
    liveHow: "كيف يعمل الدرس المباشر",
    courseHow: "كيف تعمل الدورة",
    liveSteps: [
      "اختر معلّمًا",
      "اطلب موعدًا",
      "يؤكد المعلّم الطلب",
      "التقِ بمعلّمك داخل فصل MRH",
    ],
    courseSteps: [
      "اختر دورة",
      "سجّل فيها",
      "شاهد وتعلّم",
      "علّم الدروس كمكتملة",
    ],
    charge: "لا تُخصم التكلفة إلا عندما يؤكد المعلّم طلبك.",
    teach: "درّس على MRH",
    corporate: "تدريب للفرق",
    hour: "للساعة",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

function initials(firstName: string, lastName: string) {
  return `${firstName.at(0) ?? ""}${lastName.at(0) ?? ""}`.toUpperCase();
}

export default function LandingPage({ lang }: { lang: Language }) {
  const { setLanguage } = useLanguage();
  const copy = COPY[lang];
  const base = `/${lang}`;

  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  const tutors = useQuery({
    queryKey: ["home-approved-tutors", lang],
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
        <section className="paper-hero" aria-labelledby="home-title">
          <div className="paper-aperture" aria-hidden="true" />
          <div className="paper-shell paper-hero-grid">
            <div>
              <p className="paper-kicker">{copy.kicker}</p>
              <h1 id="home-title">{copy.title}</h1>
              <p className="paper-hero-copy">{copy.intro}</p>
              <div className="mode-actions">
                <Link className="mode-action" href={`${base}/tutors`}>
                  <strong>
                    {copy.find} <DirectionalArrow />
                  </strong>
                  <span>{copy.findNote}</span>
                </Link>
                <Link className="mode-action" href={`${base}/courses`}>
                  <strong>
                    {copy.courses} <DirectionalArrow />
                  </strong>
                  <span>{copy.coursesNote}</span>
                </Link>
              </div>
            </div>
            <aside className="paper-manifesto">
              <strong>{copy.promise}</strong>
              <p>{copy.promiseBody}</p>
            </aside>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="home-tutors">
          <div className="paper-shell">
            <header className="paper-section-heading">
              <h2 id="home-tutors">{copy.tutorsTitle}</h2>
              <Link className="paper-link" href={`${base}/tutors`}>
                {copy.allTutors} <DirectionalArrow />
              </Link>
            </header>
            {tutors.isLoading ? (
              <div
                className="paper-shelf"
                aria-label={
                  lang === "ar" ? "جارٍ تحميل المعلّمين" : "Loading tutors"
                }
              >
                {[0, 1, 2].map((item) => (
                  <div className="paper-card skeleton" key={item} />
                ))}
              </div>
            ) : tutors.data?.length ? (
              <div className="paper-shelf" tabIndex={0}>
                {tutors.data.slice(0, 6).map((tutor) => {
                  const name = `${tutor.user.firstName} ${tutor.user.lastName}`;
                  return (
                    <Link
                      className="paper-card"
                      href={`${base}/tutors/${tutor.userId}`}
                      key={tutor.userId}
                    >
                      <span className="paper-avatar">
                        {tutor.user.avatarUrl ? (
                          <Image
                            src={tutor.user.avatarUrl}
                            alt=""
                            width={72}
                            height={72}
                          />
                        ) : (
                          initials(tutor.user.firstName, tutor.user.lastName)
                        )}
                      </span>
                      <h3>{name}</h3>
                      <p>{tutor.specialization}</p>
                      <p>{tutor.languages.join(" · ")}</p>
                      <footer>
                        <strong>
                          <bdi>{formatCurrency(lang, tutor.hourlyRate)}</bdi>{" "}
                          {copy.hour}
                        </strong>
                        {typeof tutor.averageRating === "number" && (
                          <span aria-label={`${tutor.averageRating} / 5`}>
                            ★ {tutor.averageRating.toFixed(1)}
                            {typeof tutor.reviewCount === "number"
                              ? ` (${tutor.reviewCount})`
                              : ""}
                          </span>
                        )}
                      </footer>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="paper-empty">{copy.noTutors}</div>
            )}
          </div>
        </section>

        <section className="paper-section" aria-labelledby="home-courses">
          <div className="paper-shell">
            <header className="paper-section-heading">
              <h2 id="home-courses">{copy.coursesTitle}</h2>
              <Link className="paper-link" href={`${base}/courses`}>
                {copy.allCourses} <DirectionalArrow />
              </Link>
            </header>
            {courses.isLoading ? (
              <div
                className="paper-shelf"
                aria-label={
                  lang === "ar" ? "جارٍ تحميل الدورات" : "Loading courses"
                }
              >
                {[0, 1, 2].map((item) => (
                  <div className="paper-card skeleton" key={item} />
                ))}
              </div>
            ) : courses.data?.length ? (
              <div className="paper-shelf" tabIndex={0}>
                {courses.data.slice(0, 6).map((course) => (
                  <Link
                    className="paper-card"
                    href={`${base}/courses/${course.id}`}
                    key={course.id}
                  >
                    <span className="paper-course-thumb">
                      {course.thumbnailUrl ? (
                        <Image
                          src={course.thumbnailUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 86vw, 30vw"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <span
                          className="paper-course-fallback"
                          aria-hidden="true"
                        >
                          <b>MRH</b>
                          <i />
                        </span>
                      )}
                    </span>
                    <h3>{course.title}</h3>
                    <p>
                      {course.tutor.firstName} {course.tutor.lastName}
                    </p>
                    <footer>
                      <strong>
                        <bdi>{formatCurrency(lang, course.price)}</bdi>
                      </strong>
                    </footer>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="paper-empty">{copy.noCourses}</div>
            )}
          </div>
        </section>

        <section className="paper-section">
          <div className="paper-shell how-grid">
            <article className="how-column">
              <h2>{copy.liveHow}</h2>
              <ol>
                {copy.liveSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="trust-line">✓ {copy.charge}</p>
            </article>
            <article className="how-column">
              <h2>{copy.courseHow}</h2>
              <ol>
                {copy.courseSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          </div>
        </section>

        <section
          className="paper-cta"
          aria-label={lang === "ar" ? "روابط إضافية" : "More ways to learn"}
        >
          <Link href={`${base}/become-a-tutor`}>
            {copy.teach} <DirectionalArrow />
          </Link>
          <Link href={`${base}/resources`}>
            {copy.corporate} <DirectionalArrow />
          </Link>
        </section>
      </main>
      <Footer language={lang} />
    </div>
  );
}
