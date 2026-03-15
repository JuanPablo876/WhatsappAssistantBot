'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** Fallback URL if no history to go back to */
  fallbackUrl?: string;
  /** Custom label (default: "Back") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable back button component
 * Uses browser history if available, otherwise navigates to fallback URL
 */
export function BackButton({ fallbackUrl = '/', label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    // Check if there's history to go back to
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
