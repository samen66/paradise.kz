'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2bAuth } from '@/stores/useB2bAuth';
import { B2BProvider } from '@/lib/b2b-context';
import { B2BHeader } from '@/components/B2BHeader';
import { B2BFooter } from '@/components/B2BFooter';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useB2bAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!user || !token) {
      router.replace('/login');
      return;
    }

    if (user.is_approved === false) {
      router.replace('/pending');
      return;
    }
  }, [user, token, pathname, router, isMounted]);

  // Prevent flash of content while checking auth
  if (!isMounted || !user || !token || user.is_approved === false) {
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
        <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
        <B2BFooter />
      </div>
    </B2BProvider>
  );
}
