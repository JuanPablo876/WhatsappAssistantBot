import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/auth/google/login
 * Starts the Google OAuth flow for login / account creation.
 * (Separate from /api/auth/google which connects Google Calendar to a tenant.)
 */
export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' },
        { status: 500 }
      );
    }

    const port = process.env.PORT || '3005';
    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${port}`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/login/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state: 'login', // Distinguishes this from the calendar flow
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Google login OAuth start error:', error);
    return NextResponse.json(
      { error: 'Failed to start Google login', details: error.message },
      { status: 500 }
    );
  }
}
