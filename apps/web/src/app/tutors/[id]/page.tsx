import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";

type Review = {
  id: string;
  rating: number;
  comment: string;
  student: { firstName: string; lastName: string };
};

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  videoUrl?: string;
  averageRating: number;
  reviewCount: number;
  user: { firstName: string; lastName: string; avatarUrl?: string };
  reviews?: Review[];
};

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

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tutor, reviews] = await Promise.all([
    getTutor(id),
    getTutorReviews(id),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/student/discover"
            className="link inline-flex items-center gap-1 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to tutors
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Card */}
        <div className="card p-8 animate-scale-in">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-4xl shadow-lg shrink-0">
              {tutor.user.firstName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {tutor.user.firstName} {tutor.user.lastName}
                  </h1>
                  <p className="text-lg text-slate-500 mt-0.5">
                    {tutor.specialization}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <StarRating rating={tutor.averageRating} />
                      <span className="text-sm text-slate-500">
                        ({tutor.reviewCount} reviews)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-4xl font-bold text-indigo-600">
                    ${tutor.hourlyRate}
                  </p>
                  <p className="text-sm text-slate-400">per hour</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {tutor.languages?.map((lang) => (
                  <span
                    key={lang}
                    className="badge bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">About</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
              {tutor.bio}
            </p>
          </div>

          {tutor.videoUrl && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">
                Intro Video
              </h2>
              <video
                controls
                className="w-full max-w-lg rounded-xl shadow-sm"
                src={tutor.videoUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Reviews
            <span className="text-slate-400 font-normal ml-2">
              ({reviews.length})
            </span>
          </h2>
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">No reviews yet</p>
              <p className="text-slate-400 text-sm mt-1">
                Be the first to leave a review for this tutor
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="pb-5 border-b border-slate-100 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold">
                      {review.student.firstName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900">
                        {review.student.firstName} {review.student.lastName}
                      </p>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm ml-11 leading-relaxed">
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
