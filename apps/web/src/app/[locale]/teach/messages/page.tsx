import { redirect } from "next/navigation";

export default async function LegacyTutorMessagesRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/messages`);
}
