"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import TutorActions from "./TutorActions";
import styles from "./TutorProfile.module.css";

export type Review = {
  id: string;
  rating: number;
  comment: string;
  student: { firstName: string; lastName: string };
};

export type AvailabilitySlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  videoUrl?: string;
  averageRating: number;
  reviewCount: number;
  studentsCount?: number;
  lessonsCount?: number;
  experienceYears?: string | number;
  country?: string;
  user: { firstName: string; lastName: string; avatarUrl?: string };
};

const DAYS = [
  { ar: "الأحد", en: "Sunday" },
  { ar: "الإثنين", en: "Monday" },
  { ar: "الثلاثاء", en: "Tuesday" },
  { ar: "الأربعاء", en: "Wednesday" },
  { ar: "الخميس", en: "Thursday" },
  { ar: "الجمعة", en: "Friday" },
  { ar: "السبت", en: "Saturday" },
] as const;

function formatTime(time: string) {
  const [hourValue, minuteValue] = time.split(":").map(Number);
  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${minuteValue.toString().padStart(2, "0")} ${period}`;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < Math.round(rating) ? styles.starFilled : undefined}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

function StatIcon({
  type,
}: {
  type: "rating" | "experience" | "students" | "lessons";
}) {
  const paths = {
    rating:
      "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
    experience: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    students:
      "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198v.001c0 .504-.123.978-.34 1.395A9.09 9.09 0 0112 22.5c-2.305 0-4.41-.857-6.013-2.27A3 3 0 019 15.75h6a3 3 0 013 2.97zM15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
    lessons:
      "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d={paths[type]}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.55}
      />
    </svg>
  );
}

export default function TutorProfileView({
  tutor,
  reviews,
  availability,
}: {
  tutor: TutorProfile;
  reviews: Review[];
  availability: AvailabilitySlot[];
}) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const fullName = `${tutor.user.firstName} ${tutor.user.lastName}`;
  const experience =
    typeof tutor.experienceYears === "number"
      ? tutor.experienceYears
      : Number.parseInt(tutor.experienceYears || "1", 10) || 1;

  const stats = [
    {
      type: "rating" as const,
      value:
        Number(tutor.reviewCount) > 0
          ? Number(tutor.averageRating || 0).toFixed(1)
          : t("جديد", "New"),
      label: t(
        `${tutor.reviewCount || 0} تقييم`,
        `${tutor.reviewCount || 0} reviews`,
      ),
    },
    {
      type: "experience" as const,
      value: `${experience}+`,
      label: t("سنوات خبرة", "years experience"),
    },
    {
      type: "students" as const,
      value: String(tutor.studentsCount ?? 0),
      label: t("طالباً", "students"),
    },
    {
      type: "lessons" as const,
      value: String(tutor.lessonsCount ?? 0),
      label: t("درساً", "lessons"),
    },
  ];

  return (
    <main className={styles.page} dir={isAr ? "rtl" : "ltr"}>
      <header className={styles.profileHeader}>
        <div className={styles.headerInner}>
          <Link href="/student/discover" className={styles.backLink}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d={isAr ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
              />
            </svg>
            {t("العودة إلى المعلمين", "Back to tutors")}
          </Link>
          <Link
            href="/"
            className={styles.wordmark}
            aria-label="Mr.H Academy home"
          >
            <span>Mr.H</span>
            <small>ACADEMY</small>
          </Link>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="tutor-profile-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {tutor.user.avatarUrl ? (
                <Image
                  src={tutor.user.avatarUrl}
                  alt={fullName}
                  width={132}
                  height={132}
                  priority
                />
              ) : (
                <span>{tutor.user.firstName[0]}</span>
              )}
              <span
                className={styles.onlineDot}
                aria-label={t("متاح للحجز", "Available to book")}
              />
            </div>

            <div className={styles.identityCopy}>
              <div className={styles.eyebrow}>
                {t("معلم معتمد", "Approved academy tutor")}
              </div>
              <div className={styles.nameLine}>
                <h1 id="tutor-profile-title">{fullName}</h1>
                <span
                  className={styles.verified}
                  title={t("معلم موثّق", "Verified tutor")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="m7.5 12 3 3 6-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.2}
                    />
                  </svg>
                </span>
              </div>
              <p className={styles.specialization}>{tutor.specialization}</p>
              {tutor.country && (
                <p className={styles.location}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 21s6-5.25 6-11a6 6 0 10-12 0c0 5.75 6 11 6 11z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                    />
                    <circle cx="12" cy="10" r="2" />
                  </svg>
                  {tutor.country}
                </p>
              )}
            </div>
          </div>

          <div className={styles.ratePanel}>
            <span>{t("سعر الحصة", "Lesson rate")}</span>
            <strong dir="ltr">${Number(tutor.hourlyRate).toFixed(0)}</strong>
            <small>{t("لكل ساعة", "per hour")}</small>
          </div>

          <div className={styles.stats}>
            {stats.map((stat) => (
              <div className={styles.stat} key={stat.type}>
                <span className={styles.statIcon}>
                  <StatIcon type={stat.type} />
                </span>
                <span>
                  <strong dir="ltr">{stat.value}</strong>
                  <small>{stat.label}</small>
                </span>
              </div>
            ))}
          </div>

          {tutor.languages?.length > 0 && (
            <div className={styles.languages}>
              <span>{t("لغات التدريس", "Teaching languages")}</span>
              <div>
                {tutor.languages.map((language) => (
                  <span key={language}>{language}</span>
                ))}
              </div>
            </div>
          )}

          <TutorActions
            tutorId={tutor.userId}
            hasAvailability={availability.length > 0}
          />
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            <section
              className={styles.readingCard}
              aria-labelledby="about-title"
            >
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>01</span>
                <div>
                  <p>{t("تعرّف على معلمك", "Meet your tutor")}</p>
                  <h2 id="about-title">{t("نبذة عني", "About me")}</h2>
                </div>
              </div>
              <p className={styles.bio}>
                {tutor.bio ||
                  t(
                    "لم يضف المعلم نبذة شخصية بعد.",
                    "This tutor has not added a biography yet.",
                  )}
              </p>
            </section>

            {tutor.videoUrl && (
              <section
                className={styles.readingCard}
                aria-labelledby="video-title"
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>02</span>
                  <div>
                    <p>{t("استمع إلى أسلوبه", "Hear their approach")}</p>
                    <h2 id="video-title">
                      {t("فيديو تعريفي", "Introduction video")}
                    </h2>
                  </div>
                </div>
                <video
                  controls
                  preload="metadata"
                  className={styles.video}
                  src={tutor.videoUrl}
                >
                  {t(
                    "متصفحك لا يدعم تشغيل الفيديو.",
                    "Your browser does not support video playback.",
                  )}
                </video>
              </section>
            )}

            <section
              id="availability"
              tabIndex={-1}
              className={styles.readingCard}
              aria-labelledby="availability-title"
            >
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>
                  {tutor.videoUrl ? "03" : "02"}
                </span>
                <div>
                  <p>{t("خطط لدرس يناسبك", "Find your ideal time")}</p>
                  <h2 id="availability-title">
                    {t("الأوقات المتاحة أسبوعياً", "Weekly availability")}
                  </h2>
                </div>
              </div>

              {availability.length > 0 ? (
                <div className={styles.availabilityGrid}>
                  {DAYS.map((day, dayIndex) => {
                    const slots = availability.filter(
                      (slot) => slot.dayOfWeek === dayIndex,
                    );
                    return (
                      <article className={styles.dayCard} key={day.en}>
                        <div>
                          <strong>{isAr ? day.ar : day.en}</strong>
                          <small>
                            {slots.length
                              ? t(
                                  `${slots.length} موعد`,
                                  `${slots.length} slot${slots.length > 1 ? "s" : ""}`,
                                )
                              : t("غير متاح", "Unavailable")}
                          </small>
                        </div>
                        <div className={styles.slotList}>
                          {slots.length ? (
                            slots.map((slot) => (
                              <span key={slot.id} dir="ltr">
                                {formatTime(slot.startTime)} –{" "}
                                {formatTime(slot.endTime)}
                              </span>
                            ))
                          ) : (
                            <span className={styles.noSlot}>—</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 2v3m8-3v3M4 9h16M6 4h12a2 2 0 012 2v14H4V6a2 2 0 012-2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                      />
                    </svg>
                  </span>
                  <strong>
                    {t(
                      "لا توجد مواعيد منشورة حالياً",
                      "No published times yet",
                    )}
                  </strong>
                  <p>
                    {t(
                      "أرسل رسالة للمعلم للاستفسار عن أقرب موعد متاح.",
                      "Message the tutor to ask about their next available time.",
                    )}
                  </p>
                </div>
              )}
            </section>

            <section
              className={styles.readingCard}
              aria-labelledby="reviews-title"
            >
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>
                  {tutor.videoUrl ? "04" : "03"}
                </span>
                <div>
                  <p>{t("تجارب الطلاب", "Student experiences")}</p>
                  <h2 id="reviews-title">
                    {t("التقييمات", "Reviews")} <span>({reviews.length})</span>
                  </h2>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                      />
                    </svg>
                  </span>
                  <strong>{t("لا توجد تقييمات بعد", "No reviews yet")}</strong>
                  <p>
                    {t(
                      "احجز درساً وكن أول من يشارك تجربته.",
                      "Book a lesson and be the first to share your experience.",
                    )}
                  </p>
                </div>
              ) : (
                <div className={styles.reviewList}>
                  {reviews.map((review) => (
                    <article className={styles.review} key={review.id}>
                      <div className={styles.reviewerAvatar}>
                        {review.student.firstName[0]}
                      </div>
                      <div>
                        <div className={styles.reviewMeta}>
                          <strong>
                            {review.student.firstName} {review.student.lastName}
                          </strong>
                          <StarRating rating={review.rating} />
                        </div>
                        <p>{review.comment}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className={styles.bookingAside}>
            <div className={styles.bookingCard}>
              <p className={styles.bookingEyebrow}>
                {t("ابدأ رحلة التعلّم", "Start learning")}
              </p>
              <h2>
                {t("هل هذا المعلم مناسب لك؟", "Is this tutor right for you?")}
              </h2>
              <p>
                {t(
                  "احجز درساً تجريبياً وتعرّف على أسلوب المعلم قبل الاستمرار.",
                  "Book a trial lesson and experience the tutor’s teaching style before continuing.",
                )}
              </p>
              <Link
                href={`/book-lesson?tutorId=${tutor.userId}`}
                className={styles.asideBookButton}
              >
                {t("احجز درساً تجريبياً", "Book a trial lesson")}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d={isAr ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                  />
                </svg>
              </Link>
              <small>
                {t(
                  "يمكنك مراجعة الوقت والسعر قبل التأكيد",
                  "Review the time and price before confirming",
                )}
              </small>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
