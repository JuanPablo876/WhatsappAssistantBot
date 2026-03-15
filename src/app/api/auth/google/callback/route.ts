import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/db';

/**
 * GET /api/auth/google/callback
 * Handles the Google OAuth callback — exchanges code for tokens & saves them.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // tenant ID
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Google OAuth denied:', error);
      return NextResponse.redirect(new URL('/dashboard/settings?google=denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/dashboard/settings?google=error', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const port = process.env.PORT || '3005';
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/callback`
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/dashboard/settings?google=error', request.url));
    }

    // Save tokens to the tenant
    await prisma.tenant.update({
      where: { id: state },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        googleCalendarId: 'primary',
      },
    });

    console.log(`Google Calendar connected for tenant ${state}`);
    return NextResponse.redirect(new URL('/dashboard/settings?google=connected', request.url));
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/dashboard/settings?google=error', request.url));
  }
}
