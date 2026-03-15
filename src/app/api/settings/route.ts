import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';

export async function POST(request: Request) {
  try {
    const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });
    const body = await request.json();

    // Serialize arrays to JSON strings for SQLite storage
    const reminderLeadMinutes = JSON.stringify(body.reminderLeadMinutes ?? []);
    const reminderChannels = JSON.stringify(body.reminderChannels ?? []);

    await prisma.businessProfile.upsert({
      where: { tenantId: tenant.id },
      update: {
        businessName: body.businessName,
        businessType: body.businessType,
        description: body.description,
        services: body.services,
        systemPrompt: body.systemPrompt,
        tone: body.tone,
        language: body.language,
        timezone: body.timezone,
        workingDays: body.workingDays,
        openTime: body.openTime,
        closeTime: body.closeTime,
        slotDuration: body.slotDuration,
        welcomeMessage: body.welcomeMessage,
        // Notification settings
        reminderLeadMinutes,
        reminderChannels,
        quietHoursStart: body.quietHoursStart || null,
        quietHoursEnd: body.quietHoursEnd || null,
        emailProvider: body.emailProvider || null,
        emailApiKey: body.emailApiKey || null,
        emailFromAddress: body.emailFromAddress || null,
      },
      create: {
        tenantId: tenant.id,
        businessName: body.businessName,
        businessType: body.businessType,
        description: body.description,
        services: body.services,
        systemPrompt: body.systemPrompt,
        tone: body.tone,
        language: body.language,
        timezone: body.timezone,
        workingDays: body.workingDays,
        openTime: body.openTime,
        closeTime: body.closeTime,
        slotDuration: body.slotDuration,
        welcomeMessage: body.welcomeMessage,
        // Notification settings
        reminderLeadMinutes,
        reminderChannels,
        quietHoursStart: body.quietHoursStart || null,
        quietHoursEnd: body.quietHoursEnd || null,
        emailProvider: body.emailProvider || null,
        emailApiKey: body.emailApiKey || null,
        emailFromAddress: body.emailFromAddress || null,
      },
    });

    // Update owner phone on tenant (for bot notifications)
    if (body.ownerPhone !== undefined) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { ownerPhone: body.ownerPhone || null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
