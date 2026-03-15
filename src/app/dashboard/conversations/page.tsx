import { getAuthenticatedUserWithTenant } from '@/lib/auth-local';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import Link from 'next/link';

dayjs.extend(relativeTime);

export default async function ConversationsPage() {
  const { activeTenant: tenant } = await getAuthenticatedUserWithTenant();
  if (!tenant) redirect('/create-tenant');
  if (!tenant.onboardingComplete) redirect('/dashboard/onboarding');

  const conversations = await prisma.conversation.findMany({
    where: { tenantId: tenant.id },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Conversations</h1>
        <p className="text-[var(--muted)]">
          View all conversations your AI assistant has had with clients.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h3 className="font-semibold mb-1">No conversations yet</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            Once your WhatsApp bot is connected and clients message you, conversations will appear here.
          </p>
          <Link
            href="/dashboard/whatsapp"
            className="inline-block px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium"
          >
            Connect WhatsApp
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const lastMsg = conv.messages[0];
            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="card p-4 flex items-center gap-4 hover:border-[var(--border-light)] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-sm font-medium text-[var(--primary)]">
                  {conv.contact.name?.[0]?.toUpperCase() || conv.contact.phone.slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {conv.contact.name || conv.contact.phone}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        conv.status === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-400'
                          : conv.status === 'CLOSED'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {conv.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] truncate mt-0.5">
                    {lastMsg
                      ? `${lastMsg.role === 'assistant' ? '🤖 ' : ''}${lastMsg.content.slice(0, 80)}${lastMsg.content.length > 80 ? '...' : ''}`
                      : 'No messages'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-[var(--muted)]">
                    {dayjs(conv.updatedAt).fromNow()}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {conv._count.messages} msgs
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
