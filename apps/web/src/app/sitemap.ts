import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = [
    "",
    "/tutors",
    "/courses",
    "/become-a-tutor",
    "/resources",
    "/help",
  ];
  return routes.flatMap((path) =>
    ["ar", "en"].map((locale) => ({
      url: `${baseUrl}/${locale}${path}`,
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: {
          ar: `${baseUrl}/ar${path}`,
          en: `${baseUrl}/en${path}`,
        },
      },
    })),
  );
}
