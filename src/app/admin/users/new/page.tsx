'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'BUSINESS_OWNER' as 'ADMIN' | 'BUSINESS_OWNER',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        setLoading(false);
        return;
      }

      router.push('/admin/users');
    } catch {
      setError('Failed to create user');
      setLoading(false);
    }
  }

  return (
    <motion.div className="max-w-lg" variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="mb-8">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-3 group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">Add New User</h1>
        <p className="text-white/40 text-sm">Create a new user account</p>
      </motion.div>

      <motion.form variants={item} onSubmit={handleSubmit} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-5">
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </motion.div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" required className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required minLength={6} className={inputClass} />
          <p className="text-xs text-white/25 mt-1.5">Minimum 6 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'BUSINESS_OWNER' })} className={inputClass + ' appearance-none'}>
            <option value="BUSINESS_OWNER" className="bg-[#0a0a12] text-white">Business Owner</option>
            <option value="ADMIN" className="bg-[#0a0a12] text-white">Admin (Full Access)</option>
          </select>
          <p className="text-xs text-white/25 mt-1.5">Admins can manage all users and tenants</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/admin/users" className="flex-1 text-center py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.03] transition-all duration-200 text-sm">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium text-sm shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating...
              </span>
            ) : 'Create User'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
