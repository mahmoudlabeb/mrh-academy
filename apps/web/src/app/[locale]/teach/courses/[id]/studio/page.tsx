"use client";

import { useParams } from "next/navigation";
import { CourseStudioEditor } from "@/app/tutor/components/CourseStudio";

export default function ExistingCourseStudioRoute() {
  const params = useParams<{ id: string }>();
  return <CourseStudioEditor courseId={params.id} />;
}
