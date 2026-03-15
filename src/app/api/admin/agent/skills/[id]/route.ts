import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import type { SkillReviewStatus, SkillDeliveryMode } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string }> };

// GET: Get a single skill with full details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const skill = await prisma.agentSkill.findUnique({
      where: { id },
      include: {
        sources: true,
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    return NextResponse.json({
      skill: {
        ...skill,
        tags: JSON.parse(skill.tags),
        codeSnippets: JSON.parse(skill.codeSnippets),
      },
    });
  } catch (error) {
    console.error('Get skill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update a skill
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.agentSkill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedByUserId: user.id,
    };

    // Allowed fields to update
    if (body.title !== undefined) updateData.title = String(body.title).slice(0, 200);
    if (body.category !== undefined) updateData.category = String(body.category).slice(0, 50);
    if (body.summary !== undefined) updateData.summary = String(body.summary).slice(0, 5000);
    if (body.workflowGuidance !== undefined) updateData.workflowGuidance = String(body.workflowGuidance).slice(0, 20000);
    if (body.implementationNotes !== undefined) updateData.implementationNotes = String(body.implementationNotes).slice(0, 10000);
    if (Array.isArray(body.tags)) updateData.tags = JSON.stringify(body.tags.slice(0, 20));
    if (Array.isArray(body.codeSnippets)) updateData.codeSnippets = JSON.stringify(body.codeSnippets.slice(0, 10));
    if (typeof body.priority === 'number') updateData.priority = Math.min(Math.max(body.priority, 0), 2);
    if (typeof body.isEnabled === 'boolean') updateData.isEnabled = body.isEnabled;
    
    // Review status transitions
    if (body.reviewStatus !== undefined) {
      const validStatuses: SkillReviewStatus[] = ['PROPOSED', 'REVIEWED', 'REJECTED', 'ARCHIVED'];
      if (validStatuses.includes(body.reviewStatus)) {
        updateData.reviewStatus = body.reviewStatus;
        if (body.reviewStatus === 'REVIEWED') {
          updateData.lastReviewedAt = new Date();
        }
        // Archived skills should be disabled
        if (body.reviewStatus === 'ARCHIVED') {
          updateData.isEnabled = false;
        }
      }
    }

    // Delivery mode transitions (for when promoting to native tool)
    if (body.deliveryMode !== undefined) {
      const validModes: SkillDeliveryMode[] = ['KNOWLEDGE', 'NATIVE_TOOL'];
      if (validModes.includes(body.deliveryMode)) {
        updateData.deliveryMode = body.deliveryMode;
      }
    }

    const updated = await prisma.agentSkill.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      skill: {
        ...updated,
        tags: JSON.parse(updated.tags),
        codeSnippets: JSON.parse(updated.codeSnippets),
      },
    });
  } catch (error) {
    console.error('Update skill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a skill permanently (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.agentSkill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    await prisma.agentSkill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete skill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
