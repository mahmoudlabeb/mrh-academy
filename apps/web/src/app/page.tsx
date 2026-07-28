import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieLocale = (await cookies()).get("lang_pref")?.value;
  const locale =
    cookieLocale === "ar" || cookieLocale === "en"
      ? cookieLocale
      : (await headers()).get("accept-language")?.toLowerCase().includes("ar")
        ? "ar"
        : "en";
  redirect(`/${locale}`);
}
