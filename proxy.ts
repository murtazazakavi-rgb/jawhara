import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

/**
 * Validates if the session token is valid and unexpired.
 */
function verifySessionToken(token: string): boolean {
  try {
    const decrypted = decrypt(token);
    if (!decrypted) return false;
    const payload = JSON.parse(decrypted);
    const expireDate = new Date(payload.expires);
    if (expireDate < new Date()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Let public routes go through
  const isPublicPath =
    path === '/login' ||
    path.startsWith('/p/') ||
    path.startsWith('/api/public/') ||
    path.startsWith('/api/webhooks/') || // webhook routes must be public
    path.startsWith('/_next/') ||
    path.includes('.') ||
    path === '/favicon.ico';

  const token = request.cookies.get('jawhara_session')?.value;
  const isTokenValid = token ? verifySessionToken(token) : false;

  if (!isPublicPath && !isTokenValid) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
    // Clear invalid session cookie to prevent subsequent loops
    redirectResponse.cookies.set('jawhara_session', '', { maxAge: -1, path: '/' });
    return redirectResponse;
  }

  if (path === '/login' && isTokenValid) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (handled inside endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
