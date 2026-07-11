import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";
import TutorActions from "./TutorActions";

type Review = {
  id: string;
  rating: number;
  comment: string;
  student: { firstName: string; lastName: string };
};

type AvailabilitySlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  videoUrl?: string;
  documentUrl?: string;
  averageRating: number;
  reviewCount: number;
  studentsCount?: number;
  lessonsCount?: number;
  experienceYears?: string;
  country?: string;
  user: { firstName: string; lastName: string; avatarUrl?: string };
  reviews?: Review[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

async function getTutor(id: string): Promise<TutorProfile> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/tutors/${id}`, { cache: "no-store" });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Unable to load tutor profile");
  return res.json();
}

async function getTutorReviews(id: string): Promise<Review[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/reviews/tutor/${id}`, {
      cache: "no-store",
    });
    if (res.ok) return res.json();
  } catch {}
  return [];
}

async function getTutorAvailability(id: string): Promise<AvailabilitySlot[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/tutors/${id}/availability`, {
      cache: "no-store",
    });
    if (res.ok) return res.json();
  } catch {}
  return [];
}

function StarRating({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "lg";
}) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  return (
    <span className={`flex gap-0.5 ${size === "lg" ? "text-xl" : "text-sm"}`}>
      {stars.map((filled, i) => (
        <span key={i} className={filled ? "text-amber-400" : "text-slate-200"}>
          &#9733;
        </span>
      ))}
    </span>
  );
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tutor, reviews, availability] = await Promise.all([
    getTutor(id),
    getTutorReviews(id),
    getTutorAvailability(id),
  ]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="dashboard-header">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/student/discover"
            className="link inline-flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            العودة إلى المعلمين
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="card p-8 animate-scale-in">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-lg shrink-0" style={{ background: '#D4A353' }}>
              {tutor.user.firstName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>
                      {tutor.user.firstName} {tutor.user.lastName}
                    </h1>
                    <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <p className="text-lg mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    {tutor.specialization}
                    {tutor.country && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        <span className="text-base">🌍</span> {tutor.country}
                      </span>
                    )}
                  </p>
                  
                  {/* Stats Bar */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-1.5">
                      {tutor.reviewCount > 0 ? <StarRating rating={tutor.averageRating} /> : null}
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                        {tutor.reviewCount > 0 ? tutor.averageRating.toFixed(1) : 'جديد'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ({tutor.reviewCount})
                      </span>
                    </div>
                    <div className="w-px h-4" style={{ background: 'var(--border-color)' }} />
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-xl">📅</span>
                      <span style={{ color: 'var(--text-main)' }} className="font-medium">{tutor.experienceYears || '5+ سنوات'} خبرة</span>
                    </div>
                    <div className="w-px h-4" style={{ background: 'var(--border-color)' }} />
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-xl">👥</span>
                      <span style={{ color: 'var(--text-main)' }} className="font-medium">{tutor.studentsCount || 50} طالب</span>
                    </div>
                    <div className="w-px h-4" style={{ background: 'var(--border-color)' }} />
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-xl">📖</span>
                      <span style={{ color: 'var(--text-main)' }} className="font-medium">{tutor.lessonsCount || 200} درس</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold" style={{ color: '#D4A353' }}>
                    ${tutor.hourlyRate}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>في الساعة</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {tutor.languages?.map((lang) => (
                  <span key={lang} className="badge" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}>
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <Link
              href={`/book-lesson?tutorId=${tutor.userId}`}
              className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              احجز درسًا تجريبيًا
            </Link>
            
              <TutorActions tutorId={tutor.userId} />

            <a href="#availability" className="flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl transition-all" style={{ border: '1px solid var(--border-color)', color: 'var(--text-main)', background: 'var(--bg-light)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              الجدول الزمني
            </a>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-main)' }}>نبذة عني</h2>
            <p className="leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-muted)', unicodeBidi: 'plaintext', textAlign: 'start' }}>
              {tutor.bio}
            </p>
          </div>

          {tutor.videoUrl && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                فيديو تعريفي
              </h2>
              <video controls className="w-full max-w-lg rounded-xl shadow-sm" src={tutor.videoUrl}>
                متصفحك لا يدعم تشغيل الفيديو.
              </video>
            </div>
          )}
        </div>

        {availability.length > 0 && (
          <div id="availability" className="card p-8">
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>
              الأوقات المتاحة أسبوعيًا
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {DAY_LABELS.map((dayLabel, dayIndex) => {
                const daySlots = availability.filter((s) => s.dayOfWeek === dayIndex);
                return (
                  <div key={dayLabel} className="text-center">
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{dayLabel}</p>
                    <div className="space-y-1">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot) => (
                          <div key={slot.id} className="rounded-lg px-2 py-1.5 text-xs font-medium" style={{ background: 'rgba(212, 163, 83,0.1)', border: '1px solid rgba(212, 163, 83,0.2)', color: '#D4A353' }}>
                            {formatTime(slot.startTime)}<br />{formatTime(slot.endTime)}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg px-2 py-1.5 text-xs" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          —
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card p-8">
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>
            التقييمات
            <span className="font-normal me-2" style={{ color: 'var(--text-muted)' }}>
              ({reviews.length})
            </span>
          </h2>
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-light)' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
              <p className="font-medium" style={{ color: 'var(--text-muted)' }}>لا توجد تقييمات بعد</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>كن أول من يترك تقييمًا لهذا المعلم</p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <div key={review.id} className="pb-5 last:border-0 last:pb-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#D4A353' }}>
                      {review.student.firstName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-main)' }}>
                        {review.student.firstName} {review.student.lastName}
                      </p>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <p className="text-sm me-11 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {review.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}