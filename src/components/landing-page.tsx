'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, MagneticButton } from '@/lib/visualEffects/effects';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] overflow-hidden relative">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--primary)]/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]/50 backdrop-blur-md sticky top-0 z-50"
      >
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(52,211,153,0.4)] group-hover:shadow-[0_0_25px_rgba(52,211,153,0.6)] transition-shadow duration-500">
            A
          </div>
          <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">AssistBot</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-[var(--muted)] hover:text-white transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-[var(--primary)] after:transition-all hover:after:w-full">
            Login
          </Link>
          <MagneticButton>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-full bg-white/10 border border-white/10 text-white font-medium text-sm hover:bg-white/20 transition-all shadow-lg backdrop-blur-sm"
            >
              Get Started Free
            </Link>
          </MagneticButton>
        </div>
      </motion.nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center pt-24 pb-16 px-6 text-center relative z-10">
        <motion.div 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="max-w-4xl mx-auto w-full"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/5 backdrop-blur-md text-sm text-[var(--primary)] mb-8 shadow-[0_0_30px_rgba(52,211,153,0.15)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]" />
            Next-Gen WhatsApp AI Automations
          </motion.div>
          
          <motion.h1 variants={fadeInUp} className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]">
            Your AI Assistant on <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] via-emerald-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.3)]">
              WhatsApp
            </span>
          </motion.h1>
          
          <motion.p variants={fadeInUp} className="text-xl md:text-2xl text-[var(--muted)] mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Set up a smart assistant that talks to your clients, schedules appointments,
            and handles inquiries naturally. Live in minutes.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-5 justify-center mb-24">
            <MagneticButton>
              <Link
                href="/login"
                className="group relative px-8 py-4 rounded-full gradient-primary text-white font-semibold text-lg transition-all shadow-[0_0_40px_rgba(52,211,153,0.4)] hover:shadow-[0_0_60px_rgba(52,211,153,0.6)] overflow-hidden flex items-center gap-2"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10">Start Building Free</span>
                <span className="relative z-10 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </MagneticButton>
            <MagneticButton>
              <Link
                href="#features"
                className="px-8 py-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-white font-medium text-lg hover:bg-white/10 transition-all flex items-center justify-center"
              >
                Explore Features
              </Link>
            </MagneticButton>
          </motion.div>

          {/* Features grid */}
          <motion.div variants={staggerContainer} id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-32 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[120%] bg-gradient-to-b from-transparent via-[var(--card)]/50 to-transparent blur-3xl -z-10" />

            {[
              { icon: '💬', title: 'Smart Conversations', desc: 'AI understands your business and handles client conversations naturally — scheduling, FAQ, follow-ups.' },
              { icon: '📅', title: 'Calendar Sync', desc: 'One-click Google login connects your calendar. The bot checks real availability and books directly.' },
              { icon: '🎙️', title: 'Voice & Calls', desc: 'Upgrade to Pro for AI voice responses and phone call support powered by ElevenLabs.' }
            ].map((feat, i) => (
              <motion.div 
                key={feat.title}
                variants={fadeInUp}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="group p-8 rounded-3xl bg-[var(--card)]/40 backdrop-blur-xl border border-white/5 hover:border-white/20 transition-all duration-500 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-6 border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight text-white/90">{feat.title}</h3>
                <p className="text-[var(--muted)] leading-relaxed relative z-10">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Pricing preview */}
          <motion.div variants={fadeInUp} className="mb-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-[var(--muted)] text-lg">Scale your assistant as your business grows.</p>
          </motion.div>
          
          <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mb-20 max-w-5xl mx-auto">
            
            {/* Free Tier */}
            <motion.div variants={fadeInUp} className="card p-8 rounded-3xl backdrop-blur-md bg-white/[0.02] border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="text-sm font-medium tracking-widest text-[#a1a1aa] uppercase mb-2">Starter</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold tracking-tighter">$0</span>
                <span className="text-[var(--muted)]">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['100 messages/month', 'Basic scheduling', '1 WhatsApp number', 'Standard Support'].map(item => (
                   <li key={item} className="flex items-center gap-3 text-[var(--muted)]">
                     <span className="text-emerald-500">✓</span> {item}
                   </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors font-medium border border-white/10">Get Started</button>
            </motion.div>

            {/* Basic Tier */}
            <motion.div variants={fadeInUp} className="card p-8 rounded-3xl backdrop-blur-md bg-gradient-to-b from-[var(--primary)]/10 to-[var(--background)] border-[var(--primary)]/30 relative scale-105 shadow-[0_0_40px_rgba(52,211,153,0.1)]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-[var(--primary)] rounded-full text-[10px] font-bold tracking-widest uppercase text-white shadow-lg">Most Popular</div>
              <div className="text-sm font-medium tracking-widest text-[var(--primary)] uppercase mb-2">Basic</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold tracking-tighter text-white">$29</span>
                <span className="text-[var(--muted)]">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Unlimited messages', 'Full scheduling suite', 'Custom AI personality', 'Reminders module'].map(item => (
                   <li key={item} className="flex items-center gap-3 text-white/90">
                     <span className="text-[var(--primary)] drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">✓</span> {item}
                   </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity font-bold shadow-lg shadow-[var(--primary)]/25">Upgrade to Basic</button>
            </motion.div>

            {/* Pro Tier */}
            <motion.div variants={fadeInUp} className="card p-8 rounded-3xl backdrop-blur-md bg-white/[0.02] border-white/5 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute top-[-50px] right-[-50px] w-[100px] h-[100px] bg-violet-500/20 blur-2xl group-hover:bg-violet-500/40 transition-colors duration-500" />
              <div className="text-sm font-medium tracking-widest text-violet-400 uppercase mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold tracking-tighter">$79</span>
                <span className="text-[var(--muted)]">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Everything in Basic', '🎙️ AI Voice responses', '📞 Phone call support', 'Priority Engineering Support'].map(item => (
                   <li key={item} className="flex items-center gap-3 text-[var(--muted)]">
                     <span className="text-violet-400">✓</span> {item}
                   </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20 transition-colors font-medium">Contact Sales</button>
            </motion.div>
          </motion.div>
          
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-[var(--muted-light)] py-12 border-t border-[var(--border)] relative z-10 bg-[var(--background)]">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
           <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-[10px] font-bold">A</div>
           <span className="font-semibold tracking-wide">AssistBot</span>
        </div>
        <p>Copyright © {new Date().getFullYear()} All rights reserved.</p>
      </footer>
    </div>
  );
}
