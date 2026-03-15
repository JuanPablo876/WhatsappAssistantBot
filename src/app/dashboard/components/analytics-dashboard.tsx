'use client';

import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, MagneticButton } from '@/lib/visualEffects/effects';
import Link from 'next/link';

interface AnalyticsDashboardProps {
  stats: any[];
  profile: any;
}

export function AnalyticsDashboard({ stats, profile }: AnalyticsDashboardProps) {
  return (
    <motion.div 
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-8"
    >
      <motion.div variants={fadeInUp} className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-[var(--background)] to-[var(--card)] border border-[var(--border)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          Dashboard
        </h1>
        <p className="text-[var(--muted)] max-w-xl">
          Welcome back to <span className="text-[var(--primary)] font-medium">{profile?.businessName || 'your workspace'}</span>. Here's what's happening today.
        </p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label} 
            variants={fadeInUp}
            whileHover={{ y: -5, scale: 1.01 }}
            className="group relative backdrop-blur-md bg-[var(--card)]/50 p-6 rounded-2xl border border-[var(--border)] overflow-hidden transition-all duration-500 shadow-lg hover:shadow-[var(--primary)]/10"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]" />
            
            {/* Animated Glow Border Frame */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${stat.color} group-hover:w-full group-hover:opacity-10 transition-all duration-500`} />

            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className={`text-2xl w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-20 text-white shadow-inner`}>
                {stat.icon}
              </span>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-white/40 group-hover:text-white/80 transition-colors">↗</span>
              </div>
            </div>
            
            <div className="relative z-10">
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + (i * 0.1), type: 'spring' }}
                className="text-4xl font-bold mb-1 tracking-tight"
              >
                {stat.value}
              </motion.div>
              <div className="text-sm font-medium text-[var(--muted)] group-hover:text-[var(--primary)] transition-colors duration-300">
                {stat.label}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Setup Actions */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold tracking-tight">Quick Actions</h2>
          <div className="h-1px flex-1 bg-gradient-to-r from-[var(--border)] to-transparent"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link href="/dashboard/whatsapp">
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              className="card p-6 flex items-start gap-5 cursor-pointer backdrop-blur-xl bg-white/5 border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-white/10 transition-all duration-300 group rounded-2xl"
            >
               <MagneticButton>
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(52,211,153,0.3)] group-hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] transition-shadow">
                    📱
                 </div>
               </MagneticButton>
               <div className="flex-1">
                 <h3 className="font-bold text-lg mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-green-400 transition-all">Connect WhatsApp</h3>
                 <p className="text-sm text-[var(--muted)] leading-relaxed">Link your phone to start receiving and answering messages automatically.</p>
               </div>
               <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center group-hover:border-green-500 group-hover:bg-green-500/10 transition-colors">
                 <span className="text-transparent group-hover:text-green-500 transition-colors">→</span>
               </div>
            </motion.div>
          </Link>
          
          <Link href="/dashboard/voice">
            <motion.div 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              className="card p-6 flex items-start gap-5 cursor-pointer backdrop-blur-xl bg-white/5 border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-white/10 transition-all duration-300 group rounded-2xl"
            >
               <MagneticButton>
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-shadow">
                    🎙️
                 </div>
               </MagneticButton>
               <div className="flex-1">
                 <h3 className="font-bold text-lg mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-violet-400 transition-all">Setup AI Voice</h3>
                 <p className="text-sm text-[var(--muted)] leading-relaxed">Configure voice providers and test out your customized voice orb.</p>
               </div>
               <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center group-hover:border-violet-500 group-hover:bg-violet-500/10 transition-colors">
                 <span className="text-transparent group-hover:text-violet-500 transition-colors">→</span>
               </div>
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
