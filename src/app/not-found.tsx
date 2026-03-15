'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center px-4">
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-[var(--primary)] mb-2">404</h1>
          <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
          >
            ← Go Back
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-lg border border-[var(--border)] hover:bg-[var(--card)] transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
