import { prisma } from '@/lib/db';
import dayjs from 'dayjs';

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      businessProfile: true,
      whatsappConfig: { select: { channel: true } },
      _count: {
        select: {
          conversations: true,
          appointments: true,
          contacts: true,
        },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Tenants</h1>
        <p className="text-white/40 text-sm">
          All business configurations across the platform
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Business
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Owner
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Plan
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  WhatsApp
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Stats
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/10 flex items-center justify-center text-sm font-medium text-purple-400">
                        {tenant.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white/80">{tenant.name}</div>
                        <div className="text-xs text-white/30">
                          {tenant.businessProfile?.businessType || 'No type'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm text-white/60">{tenant.user.name}</div>
                    <div className="text-xs text-white/25">{tenant.user.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                      tenant.plan === 'PRO'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/10'
                        : tenant.plan === 'BASIC'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/10'
                        : 'bg-white/[0.06] text-white/40 border border-white/[0.06]'
                    }`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {tenant.whatsappConfig ? (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                        tenant.whatsappConfig.channel === 'CLOUD_API'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/10'
                      }`}>
                        {tenant.whatsappConfig.channel === 'CLOUD_API' ? 'Cloud API' : 'Baileys'}
                      </span>
                    ) : (
                      <span className="text-xs text-white/20">Not configured</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-4 text-xs text-white/40">
                      <span className="flex items-center gap-1" title="Conversations">
                        <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                        {tenant._count.conversations}
                      </span>
                      <span className="flex items-center gap-1" title="Contacts">
                        <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                        {tenant._count.contacts}
                      </span>
                      <span className="flex items-center gap-1" title="Appointments">
                        <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                        {tenant._count.appointments}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/30">
                    {dayjs(tenant.createdAt).format('MMM D, YYYY')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tenants.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5M3.75 3v18m16.5-18v18M5.25 3h13.5" /></svg>
            </div>
            <p className="text-white/30">No tenants yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
