"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type Course = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl?: string;
  tutor: { firstName: string; lastName: string };
};

export default function CoursesPage() {
  const { lang } = useLanguage();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await apiClient.get<Course[]>("/courses");
      return data;
    },
  });

  return (
    <div
      className="public-navbar-offset min-h-screen"
      style={{ background: "var(--bg-main)" }}
    >
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: "var(--text-main)" }}
        >
          {lang === "ar" ? "الكورسات" : "Courses"}
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
          {lang === "ar"
            ? "تصفح الكورسات المتاحة وسجل الآن"
            : "Browse available courses and enroll now"}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-0 overflow-hidden">
                <div className="h-40 skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-5 skeleton rounded w-3/4" />
                  <div className="h-4 skeleton rounded w-full" />
                  <div className="h-4 skeleton rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !courses?.length ? (
          <div className="text-center py-20">
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              {lang === "ar"
                ? "لا توجد كورسات متاحة حالياً"
                : "No courses available yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="card p-0 overflow-hidden group hover:translate-y-[-4px] transition-all duration-300"
              >
                <div
                  className="h-40 relative flex items-center justify-center"
                  style={{ background: "var(--bg-light)" }}
                >
                  {course.thumbnailUrl ? (
                    <Image
                      src={course.thumbnailUrl}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: "rgba(212, 163, 83,0.15)" }}
                    >
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="#D4A353"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3
                    className="font-bold text-lg mb-2"
                    style={{ color: "var(--text-main)" }}
                  >
                    {course.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed line-clamp-2 mb-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {course.tutor.firstName} {course.tutor.lastName}
                    </span>
                    <span className="font-bold" style={{ color: "#D4A353" }}>
                      ${course.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
