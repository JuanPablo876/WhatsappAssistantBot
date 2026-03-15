'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface AdminOverviewProps {
  stats: {
    userCount: number;
    tenantCount: number;
    conversationCount: number;
    appointmentCount: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  }>;
  recentTenants: Array<{
    id: string;
    name: string;
    ownerName: string;
    businessType: string | null;
    onboardingComplete: boolean;
  }>;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const } },
};

const statsConfig = [
  { key: 'userCount' as const, label: 'Total Users', color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
  )},
  { key: 'tenantCount' as const, label: 'Total Tenants', color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/20', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5M3.75 3v18m16.5-18v18M5.25 3h13.5M5.25 21V9.75a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m7.5 0V9.75a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21" /></svg>
  )},
  { key: 'conversationCount' as const, label: 'Conversations', color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/20', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
  )},
  { key: 'appointmentCount' as const, label: 'Appointments', color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
  )},
];

const quickActions = [
  { href: '/admin/users/new', label: 'Add User', gradient: 'from-blue-500/20 to-blue-600/20', border: 'hover:border-blue-500/30', icon: (
    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
  )},
  { href: '/admin/tenants', label: 'Manage Tenants', gradient: 'from-purple-500/20 to-purple-600/20', border: 'hover:border-purple-500/30', icon: (
    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5M3.75 3v18m16.5-18v18M5.25 3h13.5M5.25 21V9.75a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m7.5 0V9.75a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21" /></svg>
  )},
  { href: '/admin/conversations', label: 'View Chats', gradient: 'from-emerald-500/20 to-emerald-600/20', border: 'hover:border-emerald-500/30', icon: (
    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
  )},
  { href: '/admin/settings', label: 'Settings', gradient: 'from-amber-500/20 to-orange-500/20', border: 'hover:border-amber-500/30', icon: (
    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  )},
];

export default function AdminOverviewClient({ stats, recentUsers, recentTenants }: AdminOverviewProps) {
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
        <p className="text-white/40 text-sm">System overview and management</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsConfig.map((s) => (
          <motion.div
            key={s.key}
            variants={item}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="group relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 hover:border-white/[0.12] transition-colors duration-300"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg ${s.shadow}`}>
                  {s.icon}
                </div>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">{stats[s.key]}</div>
              <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <motion.div
          variants={item}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="font-semibold text-white/90">Recent Users</h2>
            <Link href="/admin/users" className="text-xs text-red-400/80 hover:text-red-400 transition-colors">
              View all →
            </Link>
          </div>
          <div className="p-5 space-y-2">
            {recentUsers.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/10 flex items-center justify-center text-xs font-medium text-blue-400">
                  {user.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/80 truncate">{user.name}</div>
                  <div className="text-xs text-white/30 truncate">{user.email}</div>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                  user.role === 'ADMIN' 
                    ? 'bg-red-500/15 text-red-400 border border-red-500/10' 
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/10'
                }`}>
                  {user.role}
                </span>
              </motion.div>
            ))}
            {recentUsers.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                </div>
                <p className="text-sm text-white/30">No users yet</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Tenants */}
        <motion.div
          variants={item}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="font-semibold text-white/90">Recent Tenants</h2>
            <Link href="/admin/tenants" className="text-xs text-red-400/80 hover:text-red-400 transition-colors">
              View all →
            </Link>
          </div>
          <div className="p-5 space-y-2">
            {recentTenants.map((tenant, i) => (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/10 flex items-center justify-center text-xs font-medium text-purple-400">
                  {tenant.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/80 truncate">{tenant.name}</div>
                  <div className="text-xs text-white/30 truncate">
                    by {tenant.ownerName}
                  </div>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                  tenant.onboardingComplete
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/10'
                }`}>
                  {tenant.onboardingComplete ? 'Active' : 'Setup'}
                </span>
              </motion.div>
            ))}
            {recentTenants.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5M3.75 3v18m16.5-18v18M5.25 3h13.5" /></svg>
                </div>
                <p className="text-sm text-white/30">No tenants yet</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item} className="mt-6">
        <h2 className="font-semibold text-white/90 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative overflow-hidden p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] ${action.border} transition-all duration-300 hover:bg-white/[0.04] text-center`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative">
                <div className="flex justify-center mb-3">
                  {action.icon}
                </div>
                <div className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">{action.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
