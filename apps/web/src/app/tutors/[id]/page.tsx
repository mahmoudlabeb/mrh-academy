import { notFound } from "next/navigation";
import { getServerApiBaseUrl } from "@/lib/api-url";
import TutorProfileView, {
  type AvailabilitySlot,
  type Review,
  type TutorProfile,
} from "./TutorProfileView";

async function getTutor(id: string): Promise<TutorProfile> {
  const baseUrl = getServerApiBaseUrl();
  const response = await fetch(`${baseUrl}/tutors/${id}`, {
    cache: "no-store",
  });

  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Unable to load tutor profile");
  return response.json();
}

async function getTutorReviews(id: string): Promise<Review[]> {
  const baseUrl = getServerApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/reviews/tutor/${id}`, {
      cache: "no-store",
    });
    if (response.ok) return response.json();
  } catch {
    // The profile remains useful if reviews are temporarily unavailable.
  }
  return [];
}

async function getTutorAvailability(id: string): Promise<AvailabilitySlot[]> {
  const baseUrl = getServerApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/tutors/${id}/availability`, {
      cache: "no-store",
    });
    if (response.ok) return response.json();
  } catch {
    // The profile remains useful if availability is temporarily unavailable.
  }
  return [];
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
    <TutorProfileView
      tutor={tutor}
      reviews={reviews}
      availability={availability}
    />
  );
}
