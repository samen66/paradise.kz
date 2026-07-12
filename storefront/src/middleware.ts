import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  // Check B2B routes first
  if (request.nextUrl.pathname.startsWith('/b2b')) {
    const isAuthRoute = request.nextUrl.pathname.startsWith('/b2b/login') || request.nextUrl.pathname.startsWith('/b2b/register');
    if (!isAuthRoute) {
      const token = request.cookies.get('laravel_session');
      if (!token) {
        return NextResponse.redirect(new URL('/b2b/login', request.url));
      }
    }
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const isAccountRoute = /^\/([a-z]{2}\/)?account/.test(path);
  
  if (isAccountRoute) {
    const token = request.cookies.get('laravel_session');
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Handle next-intl for all other routes
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - ... if they start with `/api`, `/_next` or `/_vercel`
  // - ... the ones containing a dot (e.g. `favicon.ico`)
  matcher: [
    '/',
    '/(ru|kk)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
