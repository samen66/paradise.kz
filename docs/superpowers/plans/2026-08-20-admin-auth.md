# Admin Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement admin authentication using Zustand, Sanctum SPA auth, and protect Next.js routes.

**Architecture:** We use Next.js App Router. We will create a `zustand` store to hold the user state. The login page will fetch the CSRF cookie and submit credentials. A `<ProtectedRoute>` component and initialization logic in `layout.tsx` will secure the application and hydrate the user state. 

**Tech Stack:** Next.js (App Router), Zustand, Tailwind CSS, Laravel Sanctum.

## Global Constraints

- Backend is running on `http://localhost:8000`.
- API calls must use `credentials: 'include'` to pass Sanctum cookies.
- We must verify `role:admin|manager` which is already handled in the backend `api.php`.

---

### Task 1: Zustand Store and Next.js setup

**Files:**
- Create: `admin/src/stores/authStore.ts`
- Modify: `admin/package.json`

**Interfaces:**
- Consumes: None
- Produces: `useAuthStore` with `user`, `isAuthenticated`, `isLoading`, `setUser()`, `logout()`

- [ ] **Step 1: Install zustand**

```bash
cd admin && npm install zustand axios
```

- [ ] **Step 2: Create the auth store**

```typescript
// admin/src/stores/authStore.ts
import { create } from 'zustand';

interface User {
  id: number;
  name: string;
  email: string;
  roles?: { name: string }[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // true by default until initialized
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
```

### Task 2: Implement Login Page

**Files:**
- Create: `admin/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `useAuthStore`
- Produces: Login route `/login`

- [ ] **Step 1: Write Login Page component**

```tsx
// admin/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setUser } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 1. Get CSRF Cookie
      await fetch('http://localhost:8000/sanctum/csrf-cookie', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      // 2. Login
      const loginRes = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        throw new Error('Неверные учетные данные');
      }

      // 3. Fetch user data
      const userRes = await fetch('http://localhost:8000/api/auth/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.data || userData);
        router.push('/products');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-2xl font-bold text-center text-gray-800">Вход для Администратора</h2>
        {error && <p className="mb-4 text-sm text-red-500 text-center">{error}</p>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Пароль</label>
            <input
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
```

### Task 3: Route Protection & App Initialization

**Files:**
- Create: `admin/src/components/ProtectedRoute.tsx`
- Modify: `admin/src/app/layout.tsx`
- Create: `admin/src/components/AuthInitializer.tsx`

**Interfaces:**
- Consumes: `useAuthStore`
- Produces: Global auth initialization and route guard

- [ ] **Step 1: Create ProtectedRoute**

```tsx
// admin/src/components/ProtectedRoute.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  }

  // Allow unauthenticated users on login page, otherwise require auth
  if (!isAuthenticated && pathname !== '/login') {
    return null; 
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create AuthInitializer**

```tsx
// admin/src/components/AuthInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/auth/me', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        
        if (res.ok) {
          const userData = await res.json();
          setUser(userData.data || userData);
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
      }
    };
    
    fetchUser();
  }, [setUser]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Update layout.tsx**

```tsx
// admin/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthInitializer from "@/components/AuthInitializer";
import ProtectedRoute from "@/components/ProtectedRoute";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paradise Admin",
  description: "Админ-панель Paradise.kz",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthInitializer>
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </AuthInitializer>
      </body>
    </html>
  );
}
```
