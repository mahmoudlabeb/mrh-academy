import LandingPage from "@/components/marketing/LandingPage";

export const dynamic = "force-dynamic";

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: "en" | "ar" }>;
}) {
  const { locale } = await params;
  return <LandingPage lang={locale} />;
}
