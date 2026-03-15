import { prisma } from '@/lib/db';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import DeleteUserButton from './delete-button';

dayjs.extend(relativeTime);

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tenants: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
          <p className="text-white/40 text-sm">
            Manage system users and their roles
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="group relative overflow-hidden px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 hover:scale-[1.02]"
        >
          <span className="relative z-10 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add User
          </span>
        </Link>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  User
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Role
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Tenants
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Status
                </th>
                <th className="text-left text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Last Login
                </th>
                <th className="text-right text-[10px] font-medium text-white/30 uppercase tracking-wider px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/10 flex items-center justify-center text-sm font-medium text-blue-400">
                        {user.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-white/80">{user.name}</div>
                        <div className="text-xs text-white/30">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/10'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/10'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-white/60">{user._count.tenants}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-white/20'}`} />
                      <span className={`text-xs ${user.isActive ? 'text-emerald-400/80' : 'text-white/30'}`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/30">
                    {user.lastLoginAt ? dayjs(user.lastLoginAt).fromNow() : 'Never'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all duration-200"
                      >
                        Edit
                      </Link>
                      <DeleteUserButton userId={user.id} userName={user.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            </div>
            <p className="text-white/30">No users yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
