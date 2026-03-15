import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

/**
 * GET /api/auth/google
 * Starts the Google OAuth flow — redirects user to Google consent screen.
 */
export async function GET() {
  try {
    const { activeTenant } = await getAuthenticatedUserWithTenant();
    if (!activeTenant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' },
        { status: 500 }
      );
    }

    // Determine the base URL for the callback
    const port = process.env.PORT || '3005';
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Gets refresh_token
      prompt: 'consent', // Forces consent to always get refresh_token
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: activeTenant.id, // Pass tenant ID through the flow
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Google OAuth start error:', error);
    return NextResponse.json(
      { error: 'Failed to start Google OAuth', details: error.message },
      { status: 500 }
    );
  }
}
