'use client';

import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Dashboard entry point — no login page.
 *
 * If the user has a valid token → redirect to /servers immediately.
 * If not → redirect to Discord OAuth immediately.
 *
 * This page is just a loading spinner while the check happens.
 */
export default function Home() {
  const { isAuthenticated, isLoading, login } = useAuthStore();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoading || redirected.current) return;

    if (isAuthenticated) {
      redirected.current = true;
      router.replace('/servers');
    } else {
      // Not authenticated — go straight to Discord OAuth
      redirected.current = true;
      login();
    }
  }, [isAuthenticated, isLoading, login, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-6">⚡</div>
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--nexus-dim)] text-sm">
          {isLoading ? 'Checking session...' : 'Redirecting to Discord...'}
        </p>
      </div>
    </div>
  );
}
