'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--muted)] mb-6">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--background)] transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
