# B2B & B2C Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move B2B Wholesale frontend functionality from Vue into the Next.js `/storefront` project to share UI components and reduce maintenance.

**Architecture:** B2B routes will be grouped under `app/(b2b)` using Next.js App Router, protected by middleware, consuming the existing Laravel Sanctum API.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Zustand, Laravel API (Backend)

## Global Constraints
- Do not modify Laravel backend API (T1-T12).
- Use Tailwind CSS for styling.
- Ensure strict separation of B2B and B2C cart state in Zustand.

---

### Task 1: Clean Up & Prepare Scaffolding

**Files:**
- Modify: `AGENTS.md`
- Delete: `frontend`
- Create: `storefront/app/(b2b)/layout.tsx`

**Interfaces:**
- Produces: Base B2B layout structure.

- [ ] **Step 1: Update AGENTS.md**

Modify `AGENTS.md` to remove references to the Vue 3 SPA and specify Next.js handles both B2C and B2B.

- [ ] **Step 2: Delete the Vue project**

```bash
rm -rf frontend
git add frontend AGENTS.md
git commit -m "refactor: drop Vue frontend in favor of Next.js unification"
```

- [ ] **Step 3: Create B2B Layout**

Create `storefront/app/(b2b)/layout.tsx`:
```tsx
import React from 'react';

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-white p-4">
        <h2 className="text-xl font-bold mb-6">B2B Portal</h2>
        <nav className="space-y-2">
          <a href="/b2b/catalog" className="block py-2">Catalog</a>
          <a href="/b2b/cart" className="block py-2">Cart</a>
          <a href="/b2b/orders" className="block py-2">Orders</a>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Commit Layout**

```bash
cd storefront
git add app/\(b2b\)/layout.tsx
git commit -m "feat(b2b): add base B2B layout"
```

---

### Task 2: Middleware and Auth Store

**Files:**
- Create: `storefront/middleware.ts`
- Create: `storefront/src/stores/useB2bAuth.ts`
- Create: `storefront/app/(b2b)/login/page.tsx`

- [ ] **Step 1: Create B2B Auth Store**

Create `storefront/src/stores/useB2bAuth.ts`:
```ts
import { create } from 'zustand';

interface B2BAuthState {
  token: string | null;
  setToken: (token: string | null) => void;
}

export const useB2bAuth = create<B2BAuthState>((set) => ({
  token: null, // In a real app, this would persist or check cookies
  setToken: (token) => set({ token }),
}));
```

- [ ] **Step 2: Create Middleware**

Create `storefront/middleware.ts`:
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/b2b') && 
      !request.nextUrl.pathname.startsWith('/b2b/login')) {
    
    // Very basic check for MVP - replace with actual cookie check
    const token = request.cookies.get('laravel_session');
    
    if (!token) {
      return NextResponse.redirect(new URL('/b2b/login', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/b2b/:path*',
};
```

- [ ] **Step 3: Create Login Page**

Create `storefront/app/(b2b)/login/page.tsx`:
```tsx
'use client';

export default function B2BLogin() {
  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">B2B Login</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="Email" className="w-full border p-2 mb-4" />
        <input type="password" placeholder="Password" className="w-full border p-2 mb-4" />
        <button type="submit" className="w-full bg-slate-900 text-white p-2">Login</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Commit Auth**

```bash
cd storefront
git add middleware.ts src/stores/useB2bAuth.ts app/\(b2b\)/login/page.tsx
git commit -m "feat(b2b): setup auth middleware and login page"
```

---

### Task 3: B2B Catalog and Cart Store

**Files:**
- Create: `storefront/src/stores/useB2bCart.ts`
- Create: `storefront/app/(b2b)/catalog/page.tsx`

- [ ] **Step 1: Create B2B Cart Store**

Create `storefront/src/stores/useB2bCart.ts`:
```ts
import { create } from 'zustand';

interface CartItem {
  id: number;
  qty: number;
}

interface B2BCartState {
  items: CartItem[];
  addItem: (id: number, qty: number) => void;
}

export const useB2bCart = create<B2BCartState>((set) => ({
  items: [],
  addItem: (id, qty) => set((state) => ({ 
    items: [...state.items, { id, qty }] 
  })),
}));
```

- [ ] **Step 2: Create Catalog Page**

Create `storefront/app/(b2b)/catalog/page.tsx`:
```tsx
'use client';

import { useB2bCart } from '@/src/stores/useB2bCart';

export default function B2BCatalog() {
  const addItem = useB2bCart((state) => state.addItem);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Catalog</h1>
      <div className="bg-white p-4 rounded shadow mb-4 flex justify-between items-center">
        <div>
          <h3 className="font-bold">Test Product A</h3>
          <p className="text-gray-600">Price: 5000 ₸</p>
        </div>
        <button onClick={() => addItem(1, 1)} className="bg-blue-600 text-white px-4 py-2 rounded">
          Add to Cart
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit Catalog & Cart**

```bash
cd storefront
git add src/stores/useB2bCart.ts app/\(b2b\)/catalog/page.tsx
git commit -m "feat(b2b): add catalog page and separate cart store"
```
