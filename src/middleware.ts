import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, type JWTPayload } from '@/lib/auth-local';

const PUBLIC_ROUTES = [
  '/login',
  '/create-tenant',
  '/api/auth/login',
  '/api/auth/google/login',          // Google OAuth login initiation (no auth needed)
  '/api/auth/google/login/callback',  // Google OAuth login callback
  '/api/auth/google/callback',        // Google Calendar OAuth callback
  '/api/webhooks',
  '/api/voice/twilio',               // Twilio voice webhooks (outbound, inbound, gather, status)
  '/api/voice/elevenlabs/audio',     // ElevenLabs audio serving (Twilio fetches generated audio)
];
const ADMIN_ROUTES = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow landing page
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check auth token
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // We can't verify JWT in edge runtime easily, so we'll do basic checks
  // Full verification happens in API routes and server components
  try {
    // Basic token structure check (3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Decode payload (without verification - that happens server-side)
    const payload = JSON.parse(atob(parts[1])) as JWTPayload & { exp: number };
    
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth_token');
      return response;
    }
    
    // Admin route protection
    if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
      if (payload.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    
    // Pass pathname to server components via header
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|public).*)',
  ],
};
