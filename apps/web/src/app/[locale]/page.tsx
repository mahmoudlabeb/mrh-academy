import LandingPage from "@/components/marketing/LandingPage";
import { AuthenticatedGuestRoute } from "@/components/shared/AuthenticatedGuestRoute";

export const dynamic = "force-dynamic";

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: "en" | "ar" }>;
}) {
  const { locale } = await params;
  return (
    <AuthenticatedGuestRoute>
      <LandingPage lang={locale} />
    </AuthenticatedGuestRoute>
  );
}
