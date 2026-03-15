import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-local';

/**
 * POST /api/onboarding/complete
 * Saves all onboarding data and marks the tenant as onboarded.
 * Creates a new tenant if the user doesn't have one yet (e.g., OAuth users).
 */
export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      businessName,
      businessType,
      description,
      services,
      systemPrompt,
      timezone,
      slotDuration,
      openTime,
      closeTime,
      workingDays,
      tone,
      language,
      welcomeMessage,
    } = body;

    // Get or create tenant for this user
    // First, check if user already has a tenant
    let tenant = await prisma.tenant.findFirst({
      where: { userId: authUser.id },
    });
    
    if (!tenant) {
      // Create a new tenant for this user
      tenant = await prisma.tenant.create({
        data: {
          userId: authUser.id,
          name: businessName || 'My Business',
          plan: 'FREE',
        },
      });
    }

    // Create or update business profile
    await prisma.businessProfile.upsert({
      where: { tenantId: tenant.id },
      update: {
        businessName,
        businessType,
        description,
        services: services || '',
        systemPrompt,
        timezone: timezone || 'America/New_York',
        slotDuration: slotDuration || 30,
        openTime: openTime || '09:00',
        closeTime: closeTime || '17:00',
        workingDays: workingDays || 'Mon,Tue,Wed,Thu,Fri',
        tone: tone || 'friendly',
        language: language || 'en',
        welcomeMessage: welcomeMessage || '',
      },
      create: {
        tenantId: tenant.id,
        businessName,
        businessType,
        description,
        services: services || '',
        systemPrompt,
        timezone: timezone || 'America/New_York',
        slotDuration: slotDuration || 30,
        openTime: openTime || '09:00',
        closeTime: closeTime || '17:00',
        workingDays: workingDays || 'Mon,Tue,Wed,Thu,Fri',
        tone: tone || 'friendly',
        language: language || 'en',
        welcomeMessage: welcomeMessage || '',
      },
    });

    // Mark onboarding as complete and update tenant name
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { 
        onboardingComplete: true,
        name: businessName || tenant.name,
      },
    });

    return NextResponse.json({ success: true, tenantId: tenant.id });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data', details: error.message },
      { status: 500 }
    );
  }
}
