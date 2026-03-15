import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth-local';
import crypto from 'crypto';

/**
 * GET /api/auth/google/login/callback
 * Handles login/signup via Google OAuth.
 *  - If a user with that googleId exists → log them in.
 *  - If a user with the same email exists → link the Google ID and log in.
 *  - Otherwise → create a new BUSINESS_OWNER account.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Google login OAuth denied:', error);
      return NextResponse.redirect(new URL('/login?error=google_denied', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=google_no_code', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const port = process.env.PORT || '3005';
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/login/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch the user's Google profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return NextResponse.redirect(new URL('/login?error=google_no_email', request.url));
    }

    const googleId = profile.id!;
    const email = profile.email.toLowerCase();
    const name = profile.name || email.split('@')[0];
    const avatarUrl = profile.picture || null;

    // 1. Check if a user with this Google ID already exists
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // 2. Check if a user with the same email exists (link Google account)
      user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        // Link Google ID to existing account
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatarUrl: user.avatarUrl || avatarUrl,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // 3. Create a new account
        // Use a random placeholder password for Google-only accounts
        // (older databases may have NOT NULL constraint on password)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        user = await prisma.user.create({
          data: {
            email,
            name,
            googleId,
            avatarUrl,
            password: randomPassword,
            role: 'BUSINESS_OWNER',
            lastLoginAt: new Date(),
          },
        });
        console.log(`New user created via Google OAuth: ${email}`);
      }
    } else {
      // Existing Google user — update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    if (!user.isActive) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', request.url));
    }

    // Set auth cookie
    await setAuthCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Redirect based on role
    const redirectPath = user.role === 'ADMIN' ? '/admin' : '/dashboard';
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error: any) {
    console.error('Google login callback error:', error);
    return NextResponse.redirect(new URL('/login?error=google_failed', request.url));
  }
}
