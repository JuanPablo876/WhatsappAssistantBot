import { prisma } from '@/lib/db';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default async function AdminConversationsPage() {
  const conversations = await prisma.conversation.findMany({
    take: 50,
    orderBy: { updatedAt: 'desc' },
    include: {
      tenant: {
        select: { name: true },
      },
      contact: {
        select: { phone: true, name: true },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">All Conversations</h1>
        <p className="text-white/40 text-sm">View conversations across all tenants</p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
            </div>
            <p className="text-white/30">No conversations yet</p>
            <p className="text-white/20 text-xs mt-1">Conversations will appear here once users start chatting</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {conversations.map((conv) => (
              <div key={conv.id} className="group p-5 hover:bg-white/[0.02] transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-white/80">{conv.contact.name || conv.contact.phone}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400/80 border border-red-500/10">
                          {conv.tenant.name}
                        </span>
                      </div>
                      <p className="text-xs text-white/30 mt-0.5">
                        {conv.contact.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/25">
                      {dayjs(conv.updatedAt).fromNow()}
                    </div>
                    <div className={`text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block ${
                      conv.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                        : 'bg-white/[0.06] text-white/30 border border-white/[0.04]'
                    }`}>
                      {conv.status}
                    </div>
                  </div>
                </div>
                {conv.messages[0] && (
                  <p className="text-sm text-white/25 mt-3 truncate pl-[52px]">
                    {conv.messages[0].content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
