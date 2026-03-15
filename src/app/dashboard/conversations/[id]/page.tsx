import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      tenantId: tenant.id,
    },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    notFound();
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
        <Link
          href="/dashboard/conversations"
          className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-sm font-medium text-[var(--primary)]">
          {conversation.contact.name?.[0]?.toUpperCase() || conversation.contact.phone.slice(-2)}
        </div>
        <div className="flex-1">
          <h1 className="font-semibold">
            {conversation.contact.name || conversation.contact.phone}
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {conversation.contact.phone} · {conversation.messages.length} messages
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            conversation.status === 'ACTIVE'
              ? 'bg-green-500/20 text-green-400'
              : conversation.status === 'CLOSED'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-[var(--border)] text-[var(--muted)]'
          }`}
        >
          {conversation.status}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {conversation.messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system' || msg.role === 'tool';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-[10px] text-[var(--muted)] bg-[var(--card)] px-2 py-1 rounded-full">
                  {msg.role === 'tool' ? '🔧 Tool call' : msg.content.slice(0, 50)}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                  isUser
                    ? 'bg-[var(--card)] text-[var(--foreground)] rounded-bl-md'
                    : 'gradient-primary text-white rounded-br-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    isUser ? 'text-[var(--muted)]' : 'text-white/70'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}

        {conversation.messages.length === 0 && (
          <div className="text-center py-12 text-[var(--muted)]">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">No messages in this conversation yet.</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--muted)]">
        Conversation started {new Date(conversation.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
