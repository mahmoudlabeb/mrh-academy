import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const dashboardPrefixes = ['/student', '/tutor', '/admin'];
const sharedProtectedPrefixes = [
  '/classroom',
  '/book-lesson',
  '/courses',
  '/vocabulary',
];
const authPages = ['/login', '/register'];

function decodeToken(token: string): { role?: string } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob !== 'undefined'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const roleRouteMap: Record<string, string> = {
  student: '/student',
  tutor: '/tutor',
  admin: '/admin',
  subadmin: '/admin',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('mrh_token')?.value;

  const isDashboardRoute = dashboardPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isSharedRoute = sharedProtectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isProtected = isDashboardRoute || isSharedRoute;
  const isAuthPage = authPages.includes(pathname);

  if (!token && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    const payload = decodeToken(token);

    if (isAuthPage) {
      const home = payload?.role ? roleRouteMap[payload.role] ?? '/' : '/';
      return NextResponse.redirect(new URL(home, request.url));
    }

    if (isDashboardRoute && payload?.role) {
      const expectedPrefix = roleRouteMap[payload.role];
      if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
        return NextResponse.redirect(new URL(expectedPrefix, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student/:path*',
    '/tutor/:path*',
    '/admin/:path*',
    '/classroom/:path*',
    '/book-lesson/:path*',
    '/courses/:path*',
    '/vocabulary/:path*',
    '/login',
    '/register',
  ],
};
