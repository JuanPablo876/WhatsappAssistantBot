'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as const } },
};

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const formData = new FormData(e.currentTarget);
    const body = {
      appName: formData.get('appName'),
      supportEmail: formData.get('supportEmail'),
      allowRegistrations: formData.get('allowRegistrations') === 'on',
      requireEmailVerification: formData.get('requireEmailVerification') === 'on',
      requireAdminApproval: formData.get('requireAdminApproval') === 'on',
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save settings');
      } else {
        setMessage('Settings saved successfully');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">System Settings</h1>
        <p className="text-white/40 text-sm">Configure global application settings</p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/15 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {message}
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <motion.div variants={item} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/10 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="font-semibold text-white/90">General</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Application Name</label>
              <input
                type="text"
                name="appName"
                defaultValue="WhatsApp Assistant Bot"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 placeholder-white/20 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Support Email</label>
              <input
                type="email"
                name="supportEmail"
                defaultValue="support@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 placeholder-white/20 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
              />
            </div>
          </div>
        </motion.div>

        {/* Registration Settings */}
        <motion.div variants={item} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/10 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
            </div>
            <h2 className="font-semibold text-white/90">Registration</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Allow new user registrations', name: 'allowRegistrations', defaultChecked: true },
              { label: 'Require email verification', name: 'requireEmailVerification', defaultChecked: true },
              { label: 'Require admin approval for new accounts', name: 'requireAdminApproval', defaultChecked: false },
            ].map((opt) => (
              <label key={opt.label} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" name={opt.name} defaultChecked={opt.defaultChecked} className="peer sr-only" />
                  <div className="w-10 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] peer-checked:bg-red-500/30 peer-checked:border-red-500/30 transition-all duration-200" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white/40 peer-checked:bg-red-400 peer-checked:translate-x-4 transition-all duration-200 shadow-sm" />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">{opt.label}</span>
              </label>
            ))}
          </div>
        </motion.div>

        {/* API Settings */}
        <motion.div variants={item} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/10 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
            </div>
            <h2 className="font-semibold text-white/90">API Configuration</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">OpenAI API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 placeholder-white/20 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200 font-mono text-sm"
              />
              <p className="text-xs text-white/25 mt-1.5">
                Used as fallback when tenants don&apos;t have their own key
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">WhatsApp Cloud API Token</label>
              <input
                type="password"
                placeholder="EAAx..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 placeholder-white/20 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200 font-mono text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Limits */}
        <motion.div variants={item} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/10 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            </div>
            <h2 className="font-semibold text-white/90">Default Limits</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Max Tenants per User</label>
              <input
                type="number"
                defaultValue={5}
                min={1}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Max Messages/Day (Free)</label>
              <input
                type="number"
                defaultValue={100}
                min={0}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200"
              />
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="group relative overflow-hidden px-8 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            <span className="relative z-10 flex items-center gap-2">
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </span>
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}
