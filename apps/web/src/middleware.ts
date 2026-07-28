import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedLocalizedPrefixes = [
  "/learn",
  "/teach",
  "/ops",
  "/lesson",
  "/room",
  "/messages",
  "/notifications",
  "/account",
];

function localizedPath(pathname: string) {
  const match = pathname.match(/^\/(en|ar)(\/.*)?$/);
  if (!match) return null;
  return { locale: match[1], route: match[2] || "/" };
}

function legacyDestination(pathname: string, search: string) {
  const mappings: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^\/student$/, () => "/en/learn"],
    [/^\/student\/lessons$/, () => "/en/learn/lessons"],
    [/^\/student\/wallet$/, () => "/en/learn/wallet"],
    [/^\/student\/discover$/, () => "/en/tutors"],
    [/^\/tutor$/, () => "/en/teach"],
    [/^\/tutor\/availability$/, () => "/en/teach/availability"],
    [/^\/tutor\/earnings$/, () => "/en/teach/earnings"],
    [/^\/tutor\/profile$/, () => "/en/teach/profile"],
    [/^\/admin$/, () => "/en/ops"],
    [/^\/courses$/, () => "/en/courses"],
    [/^\/courses\/([^/]+)$/, (match) => `/en/courses/${match[1]}`],
    [/^\/tutors\/([^/]+)$/, (match) => `/en/tutors/${match[1]}`],
    [/^\/become-teacher$/, () => "/en/become-a-tutor"],
    [/^\/teacher-training$/, () => "/en/resources"],
    [/^\/help$/, () => "/en/help"],
    [/^\/login$/, () => "/en/sign-in"],
    [/^\/register$/, () => "/en/sign-up"],
    [/^\/forgot-password$/, () => "/en/forgot-password"],
    [/^\/messages$/, () => "/en/messages"],
    [/^\/notifications$/, () => "/en/notifications"],
    [/^\/account(?:\/profile)?$/, () => "/en/account/profile"],
    [/^\/vocabulary$/, () => "/en/learn/words"],
    [/^\/room\/([^/]+)$/, (match) => `/en/room/${match[1]}`],
    [/^\/classroom\/([^/]+)$/, (match) => `/en/room/${match[1]}`],
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
  const localized = localizedPath(pathname);
  const legacy = !localized ? legacyDestination(pathname, search) : null;

  if (legacy) return NextResponse.redirect(new URL(legacy, request.url));

  if (localized) {
    const isProtected = protectedLocalizedPrefixes.some(
      (prefix) =>
        localized.route === prefix ||
        localized.route.startsWith(`${prefix}/`),
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

  let response = NextResponse.next();
  if (process.env.NODE_ENV === "production") {
    const nonce = btoa(crypto.randomUUID());
    const requestHeaders = new Headers(request.headers);
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://api.mrh.academy wss:",
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
