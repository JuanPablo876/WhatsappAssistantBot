'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const } },
};

const inputClass =
  'w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 placeholder-white/20 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all duration-200';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'BUSINESS_OWNER';
  isActive: boolean;
  phone: string | null;
  whatsappAgentMode: 'SECRET_AGENT' | 'TENANT_BOT';
  lastLoginAt: string | null;
  createdAt: string;
  tenants: { id: string; name: string }[];
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'BUSINESS_OWNER' as 'ADMIN' | 'BUSINESS_OWNER',
    isActive: true,
    phone: '',
    whatsappAgentMode: 'SECRET_AGENT' as 'SECRET_AGENT' | 'TENANT_BOT',
  });

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch(`/api/admin/users/${userId}`);
        if (!res.ok) {
          setError('User not found');
          setLoading(false);
          return;
        }
        const data: UserData = await res.json();
        setForm({
          name: data.name,
          email: data.email,
          password: '',
          role: data.role,
          isActive: data.isActive,
          phone: data.phone || '',
          whatsappAgentMode: data.whatsappAgentMode || 'SECRET_AGENT',
        });
      } catch {
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        isActive: form.isActive,
        phone: form.phone || null,
        whatsappAgentMode: form.whatsappAgentMode,
      };
      if (form.password) {
        body.password = form.password;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update user');
        setSaving(false);
        return;
      }

      setSuccess('User updated successfully');
      setSaving(false);
    } catch {
      setError('Failed to update user');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div className="max-w-lg" variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="mb-8">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">Edit User</h1>
        <p className="text-white/40 text-sm">Update user details and permissions</p>
      </motion.div>

      {error && (
        <motion.div variants={item} className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-sm">
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/15"
        >
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {success}
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <motion.div variants={item} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              New Password <span className="text-white/30">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              minLength={6}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'BUSINESS_OWNER' })}
              className={inputClass}
            >
              <option value="BUSINESS_OWNER">Business Owner</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              WhatsApp Phone <span className="text-white/30">(with country code, e.g., 5213318888888)</span>
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="5213318888888"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-white/30">Messages from this number route to the selected agent mode</p>
          </div>

          {form.role === 'ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">WhatsApp Agent Mode</label>
              <select
                value={form.whatsappAgentMode}
                onChange={(e) => setForm({ ...form, whatsappAgentMode: e.target.value as 'SECRET_AGENT' | 'TENANT_BOT' })}
                className={inputClass}
              >
                <option value="SECRET_AGENT">Secret Agent (Admin Research Assistant)</option>
                <option value="TENANT_BOT">Tenant Bot (Test as Customer)</option>
              </select>
              <p className="mt-1 text-xs text-white/30">Controls which bot handles your WhatsApp messages</p>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="peer sr-only"
              />
              <div className="w-10 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] peer-checked:bg-emerald-500/30 peer-checked:border-emerald-500/30 transition-all duration-200" />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white/40 peer-checked:bg-emerald-400 peer-checked:translate-x-4 transition-all duration-200 shadow-sm" />
            </div>
            <span className="text-sm text-white/60">Account Active</span>
          </label>
        </motion.div>

        <motion.div variants={item} className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/users"
            className="px-5 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
          >
            Cancel
          </Link>
        </motion.div>
      </form>
    </motion.div>
  );
}
