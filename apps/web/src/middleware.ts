import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const dashboardPrefixes = ["/student", "/tutor", "/admin"];
const sharedProtectedPrefixes = [
  "/classroom",
  "/book-lesson",
  "/courses",
  "/vocabulary",
];
const authPages = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("mrh_token")?.value;

  const isDashboardRoute = dashboardPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isSharedRoute = sharedProtectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isProtected = isDashboardRoute || isSharedRoute;
  const isAuthPage = authPages.includes(pathname);

  let response = NextResponse.next();
  if (process.env.NODE_ENV === "production") {
    const nonce = btoa(crypto.randomUUID());
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://ui-avatars.com https://randomuser.me",
      "connect-src 'self' https://api.mrh.academy wss:",
      "media-src 'self' https://video.bunnycdn.com",
      "frame-src 'self' https://hooks.stripe.com",
      "worker-src 'self' blob:",
    ].join("; ");
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("x-nonce", nonce);
  }

  if (!token && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    if (isAuthPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/student/:path*",
    "/tutor/:path*",
    "/admin/:path*",
    "/classroom/:path*",
    "/book-lesson/:path*",
    "/courses/:path*",
    "/vocabulary/:path*",
    "/login",
    "/register",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
