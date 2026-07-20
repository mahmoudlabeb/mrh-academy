import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = [
    "/",
    "/en",
    "/faq",
    "/help",
    "/privacy",
    "/terms",
    "/teacher-training",
  ];
  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
