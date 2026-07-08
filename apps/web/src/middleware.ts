import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/student', '/tutor', '/admin'];
const authPages = ['/login', '/register'];

function decodeToken(token: string): { role?: string } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
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

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isAuthPage = authPages.includes(pathname);

  if (!token && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    const payload = decodeToken(token);
    if (payload?.role) {
      const expectedPrefix = roleRouteMap[payload.role];
      if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
        if (isAuthPage) {
          return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.redirect(new URL(expectedPrefix, request.url));
      }
    }

    if (isAuthPage) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/tutor/:path*', '/admin/:path*', '/login', '/register'],
};
