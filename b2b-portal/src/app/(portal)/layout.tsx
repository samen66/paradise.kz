'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2bAuth } from '@/stores/useB2bAuth';
import { B2BProvider } from '@/lib/b2b-context';
import { apiGet, ApiError } from '@/lib/api';
import { isApprovedOnlyPath } from '@/lib/approval';
import type { ApiUser } from '@/lib/types';
import { B2BHeader } from '@/components/B2BHeader';
import { B2BFooter } from '@/components/B2BFooter';
import { PendingApprovalBanner } from '@/components/PendingApprovalBanner';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, setUser, clear } = useB2bAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Approval happens in the admin panel while the client is signed in:
  // refresh the user once per visit so prices appear without a re-login.
  useEffect(() => {
    if (!token) return;

    apiGet<{ user: ApiUser }>('/auth/me', { token, revalidate: false })
      .then((response) => setUser(response.user))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          clear();
        }
      });
  }, [token, setUser, clear]);

  const isApproved = user?.is_approved === true;
  const isBlocked = !isApproved && isApprovedOnlyPath(pathname);

  useEffect(() => {
    if (!isMounted) return;

    if (!user || !token) {
      router.replace('/login');
      return;
    }

    if (isBlocked) {
      router.replace('/catalog');
    }
  }, [user, token, isBlocked, router, isMounted]);

  // Prevent flash of content while checking auth
  if (!isMounted || !user || !token || isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <B2BProvider token={token} user={user}>
      <div className="min-h-screen flex flex-col">
        <B2BHeader />
        {!isApproved && <PendingApprovalBanner />}
        <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
        <B2BFooter />
      </div>
    </B2BProvider>
  );
}
