'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useB2bAuth } from '@/stores/useB2bAuth';
import { B2BProvider } from '@/lib/b2b-context';
import { B2BHeader } from '@/components/b2b/B2BHeader';
import { B2BFooter } from '@/components/b2b/B2BFooter';
import { NextIntlClientProvider } from 'next-intl';
import ruMessages from '../../messages/ru.json';
import '../globals.css';

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token } = useB2bAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle Auth checks client-side for B2B portal
  useEffect(() => {
    if (!isMounted) return;
    
    // Login and Pending are public/semi-public routes
    if (pathname.startsWith('/b2b/login') || pathname.startsWith('/b2b/pending')) {
      return;
    }

    if (!user || !token) {
      router.replace('/b2b/login');
      return;
    }

    if (user.is_approved === false) {
      router.replace('/b2b/pending');
      return;
    }
  }, [user, token, pathname, router, isMounted]);

  // Don't render layout structure on login or pending pages
  if (pathname.startsWith('/b2b/login') || pathname.startsWith('/b2b/pending')) {
    return (
      <html lang="ru" suppressHydrationWarning>
        <body className="bg-surface font-sans antialiased text-ink min-h-screen flex flex-col" suppressHydrationWarning>
          <NextIntlClientProvider locale="ru" messages={ruMessages}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }

  // Prevent flash of content while checking auth
  if (!isMounted || !user || !token || user.is_approved === false) {
    return (
      <html lang="ru" suppressHydrationWarning>
        <body className="bg-surface font-sans antialiased min-h-screen flex items-center justify-center" suppressHydrationWarning>
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
        </body>
      </html>
    );
  }

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-surface font-sans antialiased text-ink min-h-screen flex flex-col" suppressHydrationWarning>
        <NextIntlClientProvider locale="ru" messages={ruMessages}>
          <B2BProvider token={token} user={user}>
            <B2BHeader />
            <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
              {children}
            </main>
            <B2BFooter />
          </B2BProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
