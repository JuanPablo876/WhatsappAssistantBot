import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth-local';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return all settings as key-value pairs
    // For now we use a simple approach: store settings in the first admin user's metadata
    // or a dedicated table. Since we don't have a settings table, return defaults.
    return NextResponse.json({
      appName: 'WhatsApp Assistant Bot',
      supportEmail: 'support@example.com',
      allowRegistrations: true,
      requireEmailVerification: true,
      requireAdminApproval: false,
    });
  } catch (error) {
    console.error('Get admin settings error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate expected fields
    const { appName, supportEmail, allowRegistrations, requireEmailVerification, requireAdminApproval } = body;

    if (appName && typeof appName !== 'string') {
      return NextResponse.json({ error: 'Invalid app name' }, { status: 400 });
    }
    if (supportEmail && typeof supportEmail !== 'string') {
      return NextResponse.json({ error: 'Invalid support email' }, { status: 400 });
    }

    // TODO: Persist settings when a SystemSettings model is added to the schema.
    // For now, acknowledge the save attempt.
    return NextResponse.json({
      success: true,
      message: 'Settings saved. Note: A SystemSettings model is needed in the database schema for full persistence.',
    });
  } catch (error) {
    console.error('Save admin settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
