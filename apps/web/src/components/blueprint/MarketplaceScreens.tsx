"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { RoutedPanel } from "@/components/shared/RoutedPanel";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { formatCurrency, formatWeekday } from "@/lib/format";

type Tutor = {
  userId: string;
  bio?: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  averageRating?: number;
  reviewCount?: number;
  videoUrl?: string;
  user: { firstName: string; lastName: string; avatarUrl?: string };
};

type Availability = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  student?: { firstName: string; lastName: string };
};

type Course = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string;
  price: number;
  thumbnailUrl?: string;
  previewVideoUrl?: string | null;
  courseType?: "recorded" | "live";
  learningOutcomes?: string[] | null;
  requirements?: string[] | null;
  targetAudience?: string[] | null;
  language?: string;
  level?: string;
  capacity?: number | null;
  cohortStartAt?: string | null;
  cohortEndAt?: string | null;
  tutor: { firstName: string; lastName: string; avatarUrl?: string };
};

type CourseLesson = {
  id: string;
  title: string;
  durationMinutes: number;
  lessonOrder: number;
  isCompleted?: boolean;
};

function useCopy() {
  const { lang } = useLanguage();
  return {
    lang,
    t: (ar: string, en: string) => (lang === "ar" ? ar : en),
  };
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="blueprint-public">
      <Navbar />
      <main className="blueprint-public__main">{children}</main>
      <Footer />
    </div>
  );
}

function BackForward() {
  const { lang, t } = useCopy();
  return (
    <div className="blueprint-history" aria-label={t("التنقل", "Navigation")}>
      <button
        type="button"
        onClick={() => history.back()}
        aria-label={t("رجوع", "Back")}
      >
        {lang === "ar" ? "→" : "←"}
      </button>
      <button
        type="button"
        onClick={() => history.forward()}
        aria-label={t("تقدم", "Forward")}
      >
        {lang === "ar" ? "←" : "→"}
      </button>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="blueprint-card-grid" aria-label="Loading">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="blueprint-market-card" key={index}>
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton mt-4 h-5 w-2/3 rounded" />
          <div className="skeleton mt-3 h-4 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { t } = useCopy();
  return (
    <div className="blueprint-empty">
      <span aria-hidden="true">◇</span>
      <p>{message}</p>
      {retry && (
        <button type="button" className="btn-secondary" onClick={retry}>
          {t("إعادة المحاولة", "Retry")}
        </button>
      )}
    </div>
  );
}

export function TutorCatalogScreen() {
  const { lang, t } = useCopy();
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("rating");
  const deferredSearch = useDeferredValue(search);
  const tutorsQuery = useQuery({
    queryKey: ["blueprint-tutors"],
    queryFn: async () => (await apiClient.get<Tutor[]>("/tutors")).data,
  });

  const tutors = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    const min = Number(minPrice || 0);
    const max = Number(maxPrice || Number.MAX_SAFE_INTEGER);
    return [...(tutorsQuery.data ?? [])]
      .filter((tutor) => {
        const label =
          `${tutor.user.firstName} ${tutor.user.lastName} ${tutor.specialization}`.toLowerCase();
        return (
          (!needle || label.includes(needle)) &&
          (!language || tutor.languages?.includes(language)) &&
          tutor.hourlyRate >= min &&
          tutor.hourlyRate <= max
        );
      })
      .sort((a, b) =>
        sort === "price"
          ? a.hourlyRate - b.hourlyRate
          : Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0),
      );
  }, [deferredSearch, language, maxPrice, minPrice, sort, tutorsQuery.data]);
  const languages = Array.from(
    new Set((tutorsQuery.data ?? []).flatMap((tutor) => tutor.languages ?? [])),
  ).sort();

  return (
    <PublicFrame>
      <section className="blueprint-page-head">
        <BackForward />
        <p className="blueprint-kicker">
          {t("معلمون موثقون", "Approved educators")}
        </p>
        <h1>{t("اعثر على معلم معتمد", "Find an Approved Tutor")}</h1>
        <p>
          {t(
            "اكتشف معلمين معتمدين لجلسات فردية مباشرة.",
            "Discover certified educators for focused live 1-on-1 sessions.",
          )}
        </p>
      </section>

      <section
        className="blueprint-filter-bar"
        aria-label={t("مرشحات البحث", "Tutor filters")}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("ابحث بالاسم أو التخصص", "Search name or specialty")}
          aria-label={t("بحث", "Search")}
        />
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label={t("اللغة", "Language")}
        >
          <option value="">{t("كل اللغات", "All languages")}</option>
          {languages.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)}
          placeholder={t("أقل سعر", "Min $/hr")}
        />
        <input
          type="number"
          min="0"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          placeholder={t("أعلى سعر", "Max $/hr")}
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label={t("الترتيب", "Sort")}
        >
          <option value="rating">{t("الأعلى تقييماً", "Highest rated")}</option>
          <option value="price">{t("الأقل سعراً", "Lowest price")}</option>
        </select>
      </section>

      <p className="blueprint-results-count">
        {lang === "ar"
          ? tutors.length === 0
            ? "لا يوجد معلمون معتمدون"
            : tutors.length === 1
              ? "عرض معلم معتمد واحد"
              : tutors.length === 2
                ? "عرض معلمين معتمدين"
                : `عرض ${tutors.length} معلمين معتمدين`
          : `Showing ${tutors.length} approved tutor${tutors.length === 1 ? "" : "s"}`}
      </p>
      {tutorsQuery.isLoading ? (
        <LoadingCards />
      ) : tutorsQuery.isError ? (
        <EmptyState
          message={t("تعذر تحميل المعلمين.", "Tutors could not be loaded.")}
          retry={() => tutorsQuery.refetch()}
        />
      ) : tutors.length === 0 ? (
        <EmptyState
          message={t("لا توجد نتائج مطابقة.", "No tutors match these filters.")}
        />
      ) : (
        <div className="blueprint-card-grid">
          {tutors.map((tutor) => (
            <article
              className="blueprint-market-card blueprint-tutor-card"
              key={tutor.userId}
            >
              <div className="blueprint-person">
                <div className="blueprint-avatar">
                  {tutor.user.avatarUrl ? (
                    <Image
                      src={tutor.user.avatarUrl}
                      alt={`${tutor.user.firstName} ${tutor.user.lastName}`}
                      fill
                      sizes="56px"
                    />
                  ) : (
                    <span>{tutor.user.firstName.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h2>
                    {tutor.user.firstName} {tutor.user.lastName}
                  </h2>
                  <p>{tutor.specialization}</p>
                  <small>
                    ★ {Number(tutor.averageRating ?? 0).toFixed(1)} (
                    {tutor.reviewCount ?? 0})
                  </small>
                </div>
              </div>
              <p className="blueprint-clamp">
                {tutor.bio ||
                  t(
                    "لم يضف المعلم نبذة بعد.",
                    "This tutor has not added a bio yet.",
                  )}
              </p>
              <p className="blueprint-meta">
                <strong>{t("يتحدث:", "Speaks:")}</strong>{" "}
                {(tutor.languages ?? []).join(", ") || "—"}
              </p>
              <div className="blueprint-card-actions">
                <strong>
                  {formatCurrency(lang, tutor.hourlyRate, 0)}{" "}
                  <small>/ hr</small>
                </strong>
                <Link
                  className="btn-secondary"
                  href={`/${lang}/tutors/${tutor.userId}`}
                >
                  {t("الملف", "Profile")}
                </Link>
                <Link
                  className="btn-primary"
                  href={`/${lang}/tutors/${tutor.userId}/book`}
                >
                  {t("احجز", "Book")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PublicFrame>
  );
}

function TutorProfileBody({
  tutorId,
  panel = false,
}: {
  tutorId: string;
  panel?: boolean;
}) {
  const { lang, t } = useCopy();
  const tutorQuery = useQuery({
    queryKey: ["blueprint-tutor", tutorId],
    queryFn: async () =>
      (await apiClient.get<Tutor>(`/tutors/${tutorId}`)).data,
  });
  const reviewsQuery = useQuery({
    queryKey: ["blueprint-reviews", tutorId],
    queryFn: async () =>
      (await apiClient.get<Review[]>(`/reviews/tutor/${tutorId}`)).data,
    retry: false,
  });
  const availabilityQuery = useQuery({
    queryKey: ["blueprint-availability", tutorId],
    queryFn: async () =>
      (await apiClient.get<Availability[]>(`/tutors/${tutorId}/availability`))
        .data,
    retry: false,
  });
  const tutor = tutorQuery.data;

  if (tutorQuery.isLoading) return <LoadingCards />;
  if (!tutor)
    return (
      <EmptyState
        message={t(
          "تعذر تحميل ملف المعلم.",
          "Tutor profile could not be loaded.",
        )}
        retry={() => tutorQuery.refetch()}
      />
    );

  return (
    <>
      <section className="blueprint-profile-head">
        <div className="blueprint-person">
          <div className="blueprint-avatar blueprint-avatar--large">
            {tutor.user.avatarUrl ? (
              <Image
                src={tutor.user.avatarUrl}
                alt={`${tutor.user.firstName} ${tutor.user.lastName}`}
                fill
                sizes="76px"
              />
            ) : (
              <span>{tutor.user.firstName.charAt(0)}</span>
            )}
          </div>
          <div>
            <p className="blueprint-kicker">
              {t("معلم معتمد", "Approved tutor")}
            </p>
            <h1>
              {tutor.user.firstName} {tutor.user.lastName}
            </h1>
            <p>{tutor.specialization}</p>
            <small>
              {(tutor.languages ?? []).join(", ")} · ★{" "}
              {Number(tutor.averageRating ?? 0).toFixed(1)}
            </small>
          </div>
        </div>
      </section>
      <div className="blueprint-profile-grid">
        <div className="blueprint-profile-stack">
          <section className="blueprint-media">
            <p>{t("مقدمة فيديو", "Video introduction")}</p>
            {tutor.videoUrl ? (
              <video controls preload="none" src={tutor.videoUrl} />
            ) : (
              <div className="blueprint-media-empty">
                {t(
                  "لم يرفع المعلم مقدمة فيديو.",
                  "No video introduction has been uploaded.",
                )}
              </div>
            )}
          </section>
          <section className="blueprint-surface">
            <h2>{t("نبذة عني", "About me")}</h2>
            <p>
              {tutor.bio ||
                t("لا توجد نبذة متاحة.", "No biography is available.")}
            </p>
          </section>
          <section className="blueprint-surface">
            <h2>{t("آراء الطلاب", "Student reviews")}</h2>
            {reviewsQuery.isLoading ? (
              <div className="skeleton h-16 rounded" />
            ) : reviewsQuery.data?.length ? (
              reviewsQuery.data.slice(0, 3).map((review) => (
                <article className="blueprint-review" key={review.id}>
                  <strong>
                    {review.student
                      ? `${review.student.firstName} ${review.student.lastName}`
                      : t("طالب", "Student")}
                  </strong>
                  <span>
                    {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                  </span>
                  <p>{review.comment}</p>
                </article>
              ))
            ) : (
              <p className="blueprint-muted">
                {t("لا توجد مراجعات بعد.", "No reviews yet.")}
              </p>
            )}
          </section>
          <section className="blueprint-surface">
            <h2>{t("المواعيد الأسبوعية", "Weekly availability")}</h2>
            <div className="blueprint-slot-list">
              {(availabilityQuery.data ?? []).slice(0, 8).map((slot) => (
                <span key={slot.id}>
                  {formatWeekday(lang, slot.dayOfWeek)}{" "}
                  {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                </span>
              ))}
              {!availabilityQuery.isLoading &&
                !availabilityQuery.data?.length && (
                  <p className="blueprint-muted">
                    {t(
                      "لا توجد ساعات منشورة.",
                      "No availability has been published.",
                    )}
                  </p>
                )}
            </div>
          </section>
        </div>
        <aside className="blueprint-purchase-card">
          <strong>
            {formatCurrency(lang, tutor.hourlyRate, 0)} <small>/ hour</small>
          </strong>
          <Link
            className="btn-primary"
            href={`/${lang}/tutors/${tutorId}/book`}
          >
            {t("احجز درساً", "Book a lesson")}
          </Link>
          <Link className="btn-secondary" href={`/${lang}/messages/${tutorId}`}>
            {t("راسل المعلم", "Message tutor")}
          </Link>
          <p>
            {t(
              "يتم الخصم فقط بعد تأكيد الخادم للحجز.",
              "Your wallet is charged only after server confirmation.",
            )}
          </p>
        </aside>
      </div>
      {panel && (
        <BookingPanel
          tutor={tutor}
          availability={availabilityQuery.data ?? []}
        />
      )}
    </>
  );
}

export function TutorProfileScreen({ booking = false }: { booking?: boolean }) {
  const params = useParams<{ id: string }>();
  return (
    <PublicFrame>
      <BackForward />
      <TutorProfileBody tutorId={params.id} panel={booking} />
    </PublicFrame>
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function BookingPanel({
  tutor,
  availability,
}: {
  tutor: Tutor;
  availability: Availability[];
}) {
  const { lang, t } = useCopy();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<25 | 50>(25);
  const [confirmed, setConfirmed] = useState(false);
  const balanceQuery = useQuery({
    queryKey: ["blueprint-student-balance"],
    queryFn: async () =>
      (await apiClient.get<{ balance: number }>("/students/balance")).data,
    enabled: user?.role === "student",
  });
  const selectedDay = date ? new Date(`${date}T12:00:00`).getDay() : -1;
  const dayGuidance = availability.filter(
    (slot) => slot.dayOfWeek === selectedDay,
  );
  const requestedTimeMatchesGuidance =
    Boolean(date && time) &&
    dayGuidance.some((slot) => {
      const start = slot.startTime.slice(0, 5);
      const end = slot.endTime.slice(0, 5);
      return time >= start && time < end;
    });
  const todayKey = toIsoDate(new Date());
  const requestedDateTime =
    date && time ? new Date(`${date}T${time}:00`) : null;
  const requestedTimeIsFuture =
    requestedDateTime !== null &&
    !Number.isNaN(requestedDateTime.getTime()) &&
    requestedDateTime.getTime() > Date.now();
  const total = (Number(tutor.hourlyRate) * duration) / 60;
  const balance = Number(balanceQuery.data?.balance ?? 0);
  const booking = useMutation({
    mutationFn: async () => {
      if (
        user?.role !== "student" ||
        !date ||
        date < todayKey ||
        !requestedTimeIsFuture ||
        !requestedTimeMatchesGuidance
      ) {
        throw new Error("The requested date and time are not valid");
      }
      const local = new Date(`${date}T${time}:00`);
      return (
        await apiClient.post("/lessons/book", {
          tutorId: tutor.userId,
          scheduledTime: local.toISOString(),
          durationMinutes: duration,
        })
      ).data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["blueprint-student-balance"],
        }),
        queryClient.invalidateQueries({ queryKey: ["student-lessons"] }),
      ]);
      setConfirmed(true);
    },
  });
  const close = () => router.push(`/${lang}/tutors/${tutor.userId}`);

  return (
    <RoutedPanel
      title={t(
        `احجز مع ${tutor.user.firstName}`,
        `Book with ${tutor.user.firstName}`,
      )}
      subtitle={t(
        "الأوقات حسب منطقتك الزمنية",
        `Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
      )}
      onClose={close}
      footer={
        !confirmed &&
        user?.role === "student" && (
          <button
            className="btn-primary blueprint-panel-submit"
            type="button"
            disabled={
              !requestedTimeMatchesGuidance ||
              !requestedTimeIsFuture ||
              balance < total ||
              booking.isPending ||
              balanceQuery.isLoading
            }
            onClick={() => booking.mutate()}
          >
            {booking.isPending
              ? t("جارٍ إرسال الطلب…", "Submitting request…")
              : t(
                  `إرسال طلب الموعد (${formatCurrency(lang, total)})`,
                  `Submit time request (${formatCurrency(lang, total)})`,
                )}
          </button>
        )
      }
    >
      {confirmed ? (
        <div
          className="blueprint-result blueprint-result--success"
          role="status"
        >
          <span>✓</span>
          <h3>
            {t(
              "استلم الخادم طلب الحجز",
              "Booking request received by the server",
            )}
          </h3>
          <p>
            {t(
              "راجع حالة الدرس من صفحة دروسك. لا نعرض تأكيداً نهائياً قبل حالة الخادم.",
              "Track the lesson from My Lessons. Final confirmation is shown only when returned by the server.",
            )}
          </p>
          <Link className="btn-primary" href={`/${lang}/learn/lessons`}>
            {t("عرض دروسي", "View my lessons")}
          </Link>
        </div>
      ) : authLoading ? (
        <div className="blueprint-result" aria-busy="true">
          <div className="skeleton h-14 w-full rounded" />
          <p>{t("جارٍ التحقق من حسابك…", "Checking your account…")}</p>
        </div>
      ) : !user ? (
        <div className="blueprint-result">
          <h3>
            {t("سجل الدخول لطلب موعد", "Sign in to request a lesson time")}
          </h3>
          <p>
            {t(
              "سنُعيدك إلى نافذة الحجز بعد تسجيل الدخول.",
              "You will return to this booking panel after signing in.",
            )}
          </p>
          <Link
            className="btn-primary"
            href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/tutors/${tutor.userId}/book`)}`}
          >
            {t("تسجيل الدخول", "Sign in")}
          </Link>
        </div>
      ) : user.role !== "student" ? (
        <div className="blueprint-result">
          <h3>
            {t("الحجز متاح لحساب الطالب", "Booking requires a student account")}
          </h3>
          <p>
            {t(
              "انتقل إلى مساحة الطالب أو استخدم حساب طالب لطلب موعد.",
              "Switch to the learner workspace or use a student account to request a lesson.",
            )}
          </p>
          <Link className="btn-secondary" href={`/${lang}/account/roles`}>
            {t("إدارة الأدوار", "Manage roles")}
          </Link>
        </div>
      ) : (
        <div className="blueprint-panel-form">
          <fieldset>
            <legend>
              {t("إرشاد الجدول الأسبوعي", "Weekly schedule guidance")}
            </legend>
            <p className="blueprint-note">
              {t(
                "هذه ساعات عمل متكررة وليست مخزون مواعيد مضموناً. يعيد الخادم التحقق من طلبك عند الإرسال وقد يرفض الوقت إذا أصبح مشغولاً.",
                "These are recurring working hours, not guaranteed slot inventory. The server revalidates your request and may reject a time that has become unavailable.",
              )}
            </p>
            <div className="blueprint-slot-list">
              {availability.map((slot) => (
                <span key={slot.id}>
                  {formatWeekday(lang, slot.dayOfWeek)}{" "}
                  {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                </span>
              ))}
              {!availability.length && (
                <p className="blueprint-muted">
                  {t(
                    "لم ينشر المعلم ساعات عمل بعد.",
                    "The tutor has not published working hours.",
                  )}
                </p>
              )}
            </div>
          </fieldset>
          <div className="blueprint-request-grid">
            <label>
              {t("التاريخ المطلوب", "Requested date")}
              <input
                type="date"
                min={todayKey}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              {t("الوقت المطلوب", "Requested time")}
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>
          {date && time && !requestedTimeMatchesGuidance && (
            <p className="blueprint-error">
              {t(
                "اختر وقتاً يقع داخل ساعات العمل المنشورة لهذا اليوم.",
                "Choose a time inside the tutor's published working hours for that weekday.",
              )}
            </p>
          )}
          {date &&
            time &&
            requestedTimeMatchesGuidance &&
            !requestedTimeIsFuture && (
              <p className="blueprint-error" role="alert">
                {t(
                  "اختر وقتاً لاحقاً؛ لا يمكن حجز موعد مضى.",
                  "Choose a future time; past times cannot be booked.",
                )}
              </p>
            )}
          <fieldset>
            <legend>{t("المدة", "Duration")}</legend>
            <div className="blueprint-choice-row blueprint-choice-row--wide">
              {[25, 50].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={duration === value}
                  onClick={() => setDuration(value as 25 | 50)}
                >
                  {value} {t("دقيقة", "minutes")}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="blueprint-money-preview">
            <p>
              <span>{t("إجمالي السعر", "Total price")}</span>
              <strong>{formatCurrency(lang, total)}</strong>
            </p>
            <p>
              <span>{t("تأثير المحفظة", "Wallet impact")}</span>
              <strong>
                {formatCurrency(lang, balance)} →{" "}
                {formatCurrency(lang, Math.max(0, balance - total))}
              </strong>
            </p>
            <small>
              {t(
                "يحدد الخادم النتيجة النهائية والخصم.",
                "The server determines the final status and charge.",
              )}
            </small>
          </div>
          {balanceQuery.isError && (
            <p className="blueprint-error">
              {t(
                "تعذر التحقق من الرصيد.",
                "Your wallet balance could not be verified.",
              )}
            </p>
          )}
          {balance < total && !balanceQuery.isLoading && (
            <p className="blueprint-error">
              {t("الرصيد غير كافٍ.", "Insufficient wallet balance.")}
            </p>
          )}
          {booking.isError && (
            <p className="blueprint-error" role="alert">
              {(booking.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ??
                t(
                  "تعذر إرسال الطلب. قد يكون الموعد قد حُجز أو تغير؛ راجع الساعات واختر وقتاً آخر.",
                  "The request failed. The time may have become stale or conflicted with another booking; review the schedule and choose another time.",
                )}
            </p>
          )}
        </div>
      )}
    </RoutedPanel>
  );
}

export function CourseCatalogScreen() {
  const { lang, t } = useCopy();
  const coursesQuery = useQuery({
    queryKey: ["blueprint-courses"],
    queryFn: async () => (await apiClient.get<Course[]>("/courses")).data,
  });
  return (
    <PublicFrame>
      <section className="blueprint-page-head">
        <BackForward />
        <p className="blueprint-kicker">
          {t("تعلم ذاتي موثق", "Approved self-paced learning")}
        </p>
        <h1>{t("دليل الدورات المعتمدة", "Approved Courses Catalog")}</h1>
        <p>
          {t(
            "دورات فيديو أنشأها خبراء لغة معتمدون.",
            "Self-paced video courses created by certified language experts.",
          )}
        </p>
      </section>
      {coursesQuery.isLoading ? (
        <LoadingCards />
      ) : coursesQuery.isError ? (
        <EmptyState
          message={t("تعذر تحميل الدورات.", "Courses could not be loaded.")}
          retry={() => coursesQuery.refetch()}
        />
      ) : !coursesQuery.data?.length ? (
        <EmptyState
          message={t(
            "لا توجد دورات منشورة حالياً.",
            "No approved courses are currently published.",
          )}
        />
      ) : (
        <div className="blueprint-card-grid">
          {coursesQuery.data.map((course) => (
            <article
              className="blueprint-market-card blueprint-course-card"
              key={course.id}
            >
              <div className="blueprint-course-image">
                {course.thumbnailUrl ? (
                  <Image
                    src={course.thumbnailUrl}
                    alt={course.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <span>MRH</span>
                )}
              </div>
              <h2>{course.title}</h2>
              <p>
                {t("بواسطة", "By")} {course.tutor.firstName}{" "}
                {course.tutor.lastName}
              </p>
              <p className="blueprint-clamp">{course.description}</p>
              <div className="blueprint-card-actions">
                <strong>{formatCurrency(lang, course.price)}</strong>
                <Link
                  className="btn-primary"
                  href={`/${lang}/courses/${course.id}`}
                >
                  {t("استعرض الدورة", "Inspect course")} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PublicFrame>
  );
}

function CourseDetailBody({
  courseId,
  enrollmentPanel = false,
}: {
  courseId: string;
  enrollmentPanel?: boolean;
}) {
  const { lang, t } = useCopy();
  const { user } = useAuth();
  const courseQuery = useQuery({
    queryKey: ["blueprint-course", courseId],
    queryFn: async () =>
      (await apiClient.get<Course>(`/courses/${courseId}`)).data,
  });
  const enrollmentQuery = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () =>
      (
        await apiClient.get<
          Array<{ courseId: string; progressPercentage: number }>
        >("/courses/my/enrollments")
      ).data,
    enabled: user?.role === "student",
  });
  const enrolled = enrollmentQuery.data?.some(
    (item) => item.courseId === courseId,
  );
  const lessonsQuery = useQuery({
    queryKey: ["blueprint-course-lessons", courseId],
    queryFn: async () =>
      (await apiClient.get<CourseLesson[]>(`/courses/${courseId}/lessons`))
        .data,
    enabled: Boolean(enrolled),
  });
  const course = courseQuery.data;
  if (courseQuery.isLoading) return <LoadingCards />;
  if (!course)
    return (
      <EmptyState
        message={t("تعذر تحميل الدورة.", "Course could not be loaded.")}
        retry={() => courseQuery.refetch()}
      />
    );
  return (
    <>
      <div className="blueprint-course-detail">
        <div>
          <div className="blueprint-course-hero">
            {course.thumbnailUrl ? (
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                sizes="(max-width: 900px) 100vw, 800px"
              />
            ) : (
              <span>MRH Academy</span>
            )}
          </div>
          <h1>{course.title}</h1>
          {course.subtitle && (
            <p className="blueprint-course-subtitle">{course.subtitle}</p>
          )}
          <p className="blueprint-author">
            {t("مدرب الدورة:", "Course author:")} {course.tutor.firstName}{" "}
            {course.tutor.lastName}
          </p>
          <section className="blueprint-surface">
            <h2>{t("نظرة عامة", "Course overview")}</h2>
            {course.previewVideoUrl && (
              <div className="blueprint-course-preview">
                <div>
                  <p className="blueprint-kicker">
                    {t("مقدمة المعلّم", "Instructor introduction")}
                  </p>
                  <h2>{t("استمع إلى مقدمة الدورة", "Preview the course")}</h2>
                </div>
                <video controls preload="none" src={course.previewVideoUrl} />
              </div>
            )}
            <p>{course.description}</p>
            {course.learningOutcomes?.length ? (
              <ul className="blueprint-outcome-list">
                {course.learningOutcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className="blueprint-surface">
            <h2>
              {t(
                "المنهج",
                `Curriculum${lessonsQuery.data ? ` (${lessonsQuery.data.length} lessons)` : ""}`,
              )}
            </h2>
            {enrolled ? (
              lessonsQuery.isLoading ? (
                <div className="skeleton h-24 rounded" />
              ) : (
                lessonsQuery.data?.map((lesson) => (
                  <div className="blueprint-curriculum-row" key={lesson.id}>
                    <span>▷</span>
                    <strong>
                      {String(lesson.lessonOrder).padStart(2, "0")}.{" "}
                      {lesson.title}
                    </strong>
                    <small>{lesson.durationMinutes} min</small>
                  </div>
                ))
              )
            ) : (
              <p className="blueprint-muted">
                {t(
                  "يظهر المنهج الكامل بعد التسجيل.",
                  "The full lesson list is available after enrollment.",
                )}
              </p>
            )}
          </section>
        </div>
        <aside className="blueprint-purchase-card">
          <strong>{formatCurrency(lang, course.price)}</strong>
          {enrolled ? (
            <Link
              className="btn-primary"
              href={`/${lang}/learn/courses/${course.id}`}
            >
              {t("متابعة الدورة", "Continue course")}
            </Link>
          ) : (
            <Link
              className="btn-primary"
              href={`/${lang}/courses/${course.id}/enroll`}
            >
              {t("التسجيل في الدورة", "Enroll in course")}
            </Link>
          )}
          <p>
            {t(
              "يؤكد الخادم التسجيل والخصم.",
              "Enrollment and wallet debit are confirmed by the server.",
            )}
          </p>
        </aside>
      </div>
      {enrollmentPanel && (
        <EnrollmentPanel course={course} enrolled={Boolean(enrolled)} />
      )}
    </>
  );
}

export function CourseDetailScreen({
  enrollment = false,
}: {
  enrollment?: boolean;
}) {
  const params = useParams<{ id: string }>();
  return (
    <PublicFrame>
      <BackForward />
      <CourseDetailBody courseId={params.id} enrollmentPanel={enrollment} />
    </PublicFrame>
  );
}

function EnrollmentPanel({
  course,
  enrolled,
}: {
  course: Course;
  enrolled: boolean;
}) {
  const { lang, t } = useCopy();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [complete, setComplete] = useState(enrolled);
  const balanceQuery = useQuery({
    queryKey: ["blueprint-student-balance"],
    queryFn: async () =>
      (await apiClient.get<{ balance: number }>("/students/balance")).data,
    enabled: user?.role === "student",
  });
  const enrollment = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/courses/${course.id}/enroll`)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-enrollments"] }),
        queryClient.invalidateQueries({
          queryKey: ["blueprint-student-balance"],
        }),
      ]);
      setComplete(true);
    },
  });
  const balance = Number(balanceQuery.data?.balance ?? 0);
  return (
    <RoutedPanel
      title={t("التسجيل في الدورة", "Enroll in course")}
      subtitle={course.title}
      onClose={() => router.push(`/${lang}/courses/${course.id}`)}
      footer={
        !complete && user?.role === "student" ? (
          <button
            className="btn-primary blueprint-panel-submit"
            type="button"
            disabled={balance < course.price || enrollment.isPending}
            onClick={() => enrollment.mutate()}
          >
            {enrollment.isPending
              ? t("جارٍ التسجيل…", "Enrolling…")
              : t(
                  `التسجيل مقابل ${formatCurrency(lang, course.price)}`,
                  `Enroll for ${formatCurrency(lang, course.price)}`,
                )}
          </button>
        ) : undefined
      }
    >
      {complete ? (
        <div
          className="blueprint-result blueprint-result--success"
          role="status"
          aria-live="polite"
        >
          <span>✓</span>
          <h3>
            {t("أكد الخادم تسجيلك", "Enrollment confirmed by the server")}
          </h3>
          <Link
            className="btn-primary"
            href={`/${lang}/learn/courses/${course.id}`}
          >
            {t("ابدأ التعلم", "Start learning")}
          </Link>
        </div>
      ) : user?.role !== "student" ? (
        <div className="blueprint-result">
          <h3>
            {t("سجل الدخول كطالب للمتابعة", "Sign in as a student to continue")}
          </h3>
          <Link
            className="btn-primary"
            href={`/${lang}/sign-in?next=/${lang}/courses/${course.id}/enroll`}
          >
            {t("تسجيل الدخول", "Sign in")}
          </Link>
        </div>
      ) : (
        <div className="blueprint-panel-form">
          <div className="blueprint-product-summary">
            <div className="blueprint-course-thumb">
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  sizes="80px"
                />
              ) : (
                <span>MRH</span>
              )}
            </div>
            <div>
              <strong>{course.title}</strong>
              <p>
                {t("بواسطة", "By")} {course.tutor.firstName}{" "}
                {course.tutor.lastName}
              </p>
            </div>
          </div>
          <div className="blueprint-money-preview">
            <p>
              <span>{t("إجمالي السعر", "Total price")}</span>
              <strong>{formatCurrency(lang, course.price)}</strong>
            </p>
            <p>
              <span>{t("تأثير المحفظة", "Wallet impact")}</span>
              <strong>
                {formatCurrency(lang, balance)} →{" "}
                {formatCurrency(lang, Math.max(0, balance - course.price))}
              </strong>
            </p>
            <small>
              {t(
                "لا يتغير الرصيد إلا بعد قبول الخادم للعملية.",
                "Your balance changes only after the server accepts enrollment.",
              )}
            </small>
          </div>
          {balanceQuery.isLoading && <div className="skeleton h-14 rounded" />}
          {balance < course.price && !balanceQuery.isLoading && (
            <p className="blueprint-error">
              {t(
                "الرصيد غير كافٍ لإتمام التسجيل.",
                "Your wallet balance is insufficient.",
              )}
            </p>
          )}
          {enrollment.isError && (
            <p className="blueprint-error" role="alert">
              {(
                enrollment.error as {
                  response?: { data?: { message?: string } };
                }
              )?.response?.data?.message ??
                t("تعذر التسجيل.", "Enrollment failed.")}
            </p>
          )}
        </div>
      )}
    </RoutedPanel>
  );
}
