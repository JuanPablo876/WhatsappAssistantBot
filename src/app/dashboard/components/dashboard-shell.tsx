'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, slideInList, staggerContainer, MagneticButton } from '@/lib/visualEffects/effects';

interface DashboardShellProps {
  user: {
    name: string;
    email: string;
    role: string;
    isAdmin: boolean;
  };
  tenant: {
    id: string;
    name: string;
    plan: string;
    onboardingComplete: boolean;
  };
  tenants: { id: string; name: string }[];
  businessName: string;
  children: React.ReactNode;
}

// Main navigation - limited for bottom bar
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '📊', mobileIcon: '📊' },
  { href: '/dashboard/conversations', label: 'Chats', icon: '💬', mobileIcon: '💬' },
  { href: '/dashboard/appointments', label: 'Appointments', icon: '📅', mobileIcon: '📅' },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: '📱', mobileIcon: '📱' },
  { href: '/dashboard/voice', label: 'Voice', icon: '🎙️', mobileIcon: '🎙️', pro: true },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️', mobileIcon: '⚙️' },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳', mobileIcon: '💳' },
];

// Bottom bar items (mobile) - max 5 for thumb zone
const MOBILE_NAV_ITEMS = [
  NAV_ITEMS[0], // Overview
  NAV_ITEMS[1], // Chats
  NAV_ITEMS[2], // Appointments
  NAV_ITEMS[3], // WhatsApp
  NAV_ITEMS[4], // Voice
];

export function DashboardShell({ user, tenant, tenants, businessName, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Don't show sidebar during onboarding
  if (pathname === '/dashboard/onboarding') {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function switchTenant(tenantId: string) {
    window.location.href = `/dashboard?tenant=${tenantId}`;
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] safe-top">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--background)] touch-target"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-xs">
            {businessName.charAt(0)}
          </div>
          <span className="font-semibold text-sm truncate max-w-[150px]">{businessName}</span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop always visible, Mobile slide-in */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-72 md:w-64 border-r border-[var(--border)] flex flex-col bg-[var(--card)]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-semibold">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 -mr-2 rounded-lg hover:bg-[var(--background)] touch-target"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tenant Selector */}
        <div className="px-4 py-4 md:py-5 border-b border-[var(--border)]">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-[var(--background)] rounded-lg p-2 -m-2 transition-colors touch-target"
            onClick={() => tenants.length > 1 && setShowTenantDropdown(!showTenantDropdown)}
          >
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-sm">
              {businessName.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="font-semibold text-sm truncate">{businessName}</p>
              <p className="text-xs text-[var(--muted)]">{tenant.plan} plan</p>
            </div>
            {tenants.length > 1 && (
              <span className="text-[var(--muted)] text-xs">▼</span>
            )}
          </div>
          
          {/* Tenant dropdown */}
          {showTenantDropdown && tenants.length > 1 && (
            <div className="mt-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setShowTenantDropdown(false);
                    if (t.id !== tenant.id) switchTenant(t.id);
                  }}
                  className={`w-full text-left px-3 py-3 md:py-2 text-sm hover:bg-[var(--card)] transition-colors touch-target ${
                    t.id === tenant.id ? 'text-[var(--primary)]' : ''
                  }`}
                >
                  {t.name}
                </button>
              ))}
              <hr className="my-1 border-[var(--border)]" />
              <Link
                href="/create-tenant"
                onClick={() => setSidebarOpen(false)}
                className="block w-full text-left px-3 py-3 md:py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors touch-target"
              >
                + Add Business
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <motion.nav 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex-1 px-2 py-4 space-y-1 overflow-y-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <motion.div key={item.href} variants={slideInList}>
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm transition-all focus-ring group touch-target ${
                    isActive
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] font-medium shadow-sm border border-[var(--primary)]/20'
                      : 'text-[var(--muted)] hover:text-white hover:bg-[var(--background)] border border-transparent'
                  }`}
                >
                  <MagneticButton>
                    <span className={`text-lg md:text-base transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                  </MagneticButton>
                  <span className="relative z-10">{item.label}</span>
                  {item.pro && tenant.plan === 'FREE' && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white shadow-sm font-semibold tracking-wider uppercase backdrop-blur-sm animate-pulse">PRO</span>
                  )}
                  {isActive && (
                    <motion.div 
                      layoutId="active-nav-bg"
                      className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/10 to-transparent rounded-lg -z-0 pointer-events-none"
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-sm md:text-xs font-medium text-[var(--primary)]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{user.name}</p>
                {user.isAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">ADMIN</span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] truncate">{user.email}</p>
            </div>
          </div>
          
          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 w-full px-3 py-3 md:py-2 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all touch-target"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Switch to Admin View
            </Link>
          )}
          
          <button
            onClick={handleLogout}
            className="mt-2 w-full px-3 py-3 md:py-2 text-xs text-[var(--muted)] rounded-lg border border-[var(--border)] hover:text-white hover:border-[var(--border-light)] transition-all touch-target"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-4 md:p-8 max-w-5xl"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation - Thumb Zone */}
      <motion.nav 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--card)]/90 backdrop-blur-lg border-t border-[var(--border)] safe-bottom z-30"
      >
        <div className="flex items-center justify-around px-2 py-1 relative">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl min-w-[60px] touch-target transition-all duration-300 ${
                  isActive
                    ? 'text-[var(--primary)] -translate-y-1'
                    : 'text-[var(--muted)] hover:text-white hover:-translate-y-0.5'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-active-bg"
                    className="absolute inset-0 bg-[var(--primary)]/10 rounded-xl -z-10"
                  />
                )}
                <MagneticButton>
                  <span className={`text-xl transition-transform ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''}`}>
                    {item.mobileIcon}
                  </span>
                </MagneticButton>
                <span className="text-[10px] mt-0.5 font-medium tracking-wide">{item.label}</span>
                {isActive && (
                   <motion.div 
                     layoutId="mobile-active-indicator"
                     className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--primary)]"
                   />
                )}
              </Link>
            );
          })}
          {/* More menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-2 px-3 rounded-lg min-w-[60px] text-[var(--muted)] touch-target hover:text-white transition-colors"
          >
            <MagneticButton>
              <span className="text-xl">☰</span>
            </MagneticButton>
            <span className="text-[10px] mt-0.5 font-medium tracking-wide">More</span>
          </button>
        </div>
      </motion.nav>
    </div>
  );
}
