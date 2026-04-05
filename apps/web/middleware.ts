import { NextRequest, NextResponse } from 'next/server';

/**
 * Route protection middleware.
 *
 * Rules:
 * - /login           → redirect to /clinic/dashboard if already authenticated
 * - /admin/*         → requires SUPER_ADMIN role (verified server-side in layout)
 * - /clinic/*        → requires any authenticated clinic staff role
 * - /pet-owner/*     → requires PET_OWNER role
 * - /                → redirect authenticated users to /clinic/dashboard
 * - Unauthenticated requests to protected routes → /login
 *
 * Note: The middleware only checks for cookie PRESENCE. Authoritative role
 * verification is performed server-side within each route group layout.
 */

const PUBLIC_PATHS = ['/login', '/register', '/favicon.ico', '/_next', '/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files, Next.js internals, and API routes pass through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('petiatrics_sid');

  // Unauthenticated — redirect to login with return path
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated root → redirect to clinic dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/clinic/dashboard', request.url));
  }

  // Authenticated /dashboard (old path) → redirect to /clinic/dashboard
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/clinic/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
