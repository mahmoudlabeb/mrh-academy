import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedLocalizedPrefixes = [
  "/learn",
  "/teach",
  "/ops",
  "/lesson",
  "/room",
  "/notifications",
  "/account",
];

function localizedPath(pathname: string) {
  const match = pathname.match(/^\/(en|ar)(\/.*)?$/);
  if (!match) return null;
  return { locale: match[1], route: match[2] || "/" };
}

function preferredLocale(request: NextRequest): "ar" | "en" {
  const cookieLocale = request.cookies.get("lang_pref")?.value;
  if (cookieLocale === "ar" || cookieLocale === "en") return cookieLocale;
  return request.headers.get("accept-language")?.toLowerCase().includes("ar")
    ? "ar"
    : "en";
}

function legacyDestination(
  pathname: string,
  search: string,
  locale: "ar" | "en",
) {
  const localized = (path: string) => `/${locale}${path}`;
  const mappings: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^\/student$/, () => localized("/learn")],
    [/^\/student\/lessons$/, () => localized("/learn/lessons")],
    [/^\/student\/wallet$/, () => localized("/learn/wallet")],
    [/^\/student\/discover$/, () => localized("/tutors")],
    [/^\/tutor$/, () => localized("/teach")],
    [/^\/tutor\/availability$/, () => localized("/teach/availability")],
    [/^\/tutor\/earnings$/, () => localized("/teach/earnings")],
    [/^\/tutor\/profile$/, () => localized("/teach/profile")],
    [/^\/admin$/, () => localized("/ops")],
    [/^\/courses$/, () => localized("/courses")],
    [/^\/courses\/([^/]+)$/, (match) => localized(`/courses/${match[1]}`)],
    [/^\/tutors\/([^/]+)$/, (match) => localized(`/tutors/${match[1]}`)],
    [/^\/become-teacher$/, () => localized("/become-a-tutor")],
    [/^\/teacher-training$/, () => localized("/resources")],
    [/^\/help$/, () => localized("/help")],
    [/^\/login$/, () => localized("/sign-in")],
    [/^\/register$/, () => localized("/sign-up")],
    [/^\/forgot-password$/, () => localized("/forgot-password")],
    [/^\/reset-password$/, () => localized("/reset-password")],
    [/^\/verify-email$/, () => localized("/verify-email")],
    [/^\/auth\/callback$/, () => localized("/auth/callback")],
    [/^\/notifications$/, () => localized("/notifications")],
    [/^\/account(?:\/profile)?$/, () => localized("/account/profile")],
    [/^\/room\/([^/]+)$/, (match) => localized(`/room/${match[1]}`)],
    [/^\/classroom\/([^/]+)$/, (match) => localized(`/room/${match[1]}`)],
  ];
  for (const [pattern, build] of mappings) {
    const match = pathname.match(pattern);
    if (match) return `${build(match)}${search}`;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("mrh_token")?.value;
  const negotiatedLocale = preferredLocale(request);
  const localized = localizedPath(pathname);
  const legacy = !localized
    ? legacyDestination(pathname, search, negotiatedLocale)
    : null;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(`/${negotiatedLocale}${search}`, request.url),
    );
  }

  if (legacy) return NextResponse.redirect(new URL(legacy, request.url));

  if (localized) {
    const isProtected = protectedLocalizedPrefixes.some(
      (prefix) =>
        localized.route === prefix || localized.route.startsWith(`${prefix}/`),
    );
    const isAuth =
      localized.route === "/sign-in" || localized.route === "/sign-up";
    if (!token && isProtected) {
      const loginUrl = new URL(`/${localized.locale}/sign-in`, request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
    if (token && isAuth) {
      return NextResponse.redirect(
        new URL(`/${localized.locale}/learn`, request.url),
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mrh-locale", localized?.locale ?? negotiatedLocale);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (process.env.NODE_ENV === "production") {
    const nonce = btoa(crypto.randomUUID());
    const apiOrigin = new URL(
      process.env.NEXT_PUBLIC_API_URL ??
        process.env.NEXT_PUBLIC_WS_URL ??
        "https://api.mrh.academy/api/v1",
    ).origin;
    const websocketOrigin = new URL(
      process.env.NEXT_PUBLIC_WS_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "https://api.mrh.academy",
    ).origin.replace(/^http/, "ws");
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
      `connect-src 'self' ${apiOrigin} ${websocketOrigin}`,
      "media-src 'self' https://video.bunnycdn.com https://iframe.mediadelivery.net",
      "frame-src 'self' https://iframe.mediadelivery.net https://hooks.stripe.com",
      "worker-src 'self' blob:",
    ].join("; ");
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("x-nonce", nonce);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
