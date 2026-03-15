import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth-local';
import { prisma } from '@/lib/db';

// GET: List skills with optional filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const reviewStatus = searchParams.get('reviewStatus');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summary: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [skills, total] = await Promise.all([
      prisma.agentSkill.findMany({
        where,
        include: {
          createdBy: { select: { name: true } },
          _count: { select: { sources: true } },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.agentSkill.count({ where }),
    ]);

    return NextResponse.json({
      skills: skills.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        tags: JSON.parse(s.tags),
        summary: s.summary,
        reviewStatus: s.reviewStatus,
        deliveryMode: s.deliveryMode,
        isEnabled: s.isEnabled,
        priority: s.priority,
        usageCount: s.usageCount,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        createdByName: s.createdBy.name,
        sourceCount: s._count.sources,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List skills error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new skill
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      category = 'general',
      tags = [],
      summary,
      workflowGuidance = '',
      implementationNotes = '',
      codeSnippets = [],
      priority = 0,
      isEnabled = true,
    } = body;

    if (!title || !summary) {
      return NextResponse.json({ error: 'Title and summary are required' }, { status: 400 });
    }

    const skill = await prisma.agentSkill.create({
      data: {
        title: String(title).slice(0, 200),
        category: String(category).slice(0, 50),
        tags: JSON.stringify(tags.slice?.(0, 20) || []),
        summary: String(summary).slice(0, 5000),
        workflowGuidance: String(workflowGuidance).slice(0, 20000),
        implementationNotes: String(implementationNotes).slice(0, 10000),
        codeSnippets: JSON.stringify((codeSnippets || []).slice(0, 10)),
        reviewStatus: 'PROPOSED',
        deliveryMode: 'KNOWLEDGE',
        isEnabled,
        priority: Math.min(Math.max(Number(priority) || 0, 0), 2),
        createdByUserId: user.id,
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    console.error('Create skill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
