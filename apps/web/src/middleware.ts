import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
    '/dashboard',
    '/meetings',
    '/record',
    '/upload',
    '/settings',
    '/telegram',
];

// Routes that require admin role (checked client-side, but redirect if no auth)
const adminRoutes = ['/admin'];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check for token in cookies (set by client)
    const token = request.cookies.get('token')?.value;

    // Check protected routes
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    );

    const isAdminRoute = adminRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    );

    const isAuthRoute = authRoutes.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    );

    // Redirect to login if accessing protected route without token
    if ((isProtectedRoute || isAdminRoute) && !token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect to dashboard if accessing auth routes with token
    if (isAuthRoute && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|share).*)',
    ],
};
