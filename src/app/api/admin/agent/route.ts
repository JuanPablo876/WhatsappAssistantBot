import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth-local';
import { AdminAgentService } from '@/lib/bot/admin';

const agentService = new AdminAgentService();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, sessionId } = body as { message?: string; sessionId?: string };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const response = await agentService.handleMessage(
      user.id,
      user.name,
      message.trim(),
      sessionId,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Admin agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: List sessions
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessions = await agentService.listSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
