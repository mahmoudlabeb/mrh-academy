import { notFound } from "next/navigation";
import { LocaleSynchronizer } from "@/components/shared/LocaleSynchronizer";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ar") notFound();
  return <LocaleSynchronizer locale={locale}>{children}</LocaleSynchronizer>;
}
