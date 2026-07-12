# B2B Layout Hydration Mismatch Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suppress hydration warnings on B2B layout `<body>` tags caused by client-side browser extensions.

**Architecture:** Add React's standard `suppressHydrationWarning={true}` prop to the three `<body>` tags in `storefront/src/app/b2b/layout.tsx`.

**Tech Stack:** Next.js (App Router, TypeScript), React 19

## Global Constraints
- Next.js Version: 16.2.10 (Turbopack)
- Location: `/storefront`
- No new npm dependencies.

---

### Task 1: Add suppressHydrationWarning to B2B Layout

**Files:**
- Modify: `storefront/src/app/b2b/layout.tsx`

**Interfaces:**
- Consumes: None
- Produces: Hydrated layout with suppressed hydration warnings

- [ ] **Step 1: Write the minimal implementation change**

Modify `storefront/src/app/b2b/layout.tsx` to add `suppressHydrationWarning` to the three `<body>` elements on lines 42, 53, and 74.

```diff
-        <body className="bg-surface font-sans antialiased text-ink">
+        <body className="bg-surface font-sans antialiased text-ink" suppressHydrationWarning>
```

```diff
-        <body className="bg-surface font-sans antialiased min-h-screen flex items-center justify-center">
+        <body className="bg-surface font-sans antialiased min-h-screen flex items-center justify-center" suppressHydrationWarning>
```

```diff
-      <body className="bg-surface font-sans antialiased text-ink flex min-h-screen">
+      <body className="bg-surface font-sans antialiased text-ink flex min-h-screen" suppressHydrationWarning>
```

- [ ] **Step 2: Run build lint check to verify compilation**

Run: `npm run lint` inside `storefront` directory
Expected: PASS with no linting errors

- [ ] **Step 3: Run storefront build to verify compilation**

Run: `npm run build` inside `storefront` directory
Expected: PASS with successful static page/layout compilation

- [ ] **Step 4: Commit changes**

```bash
git add storefront/src/app/b2b/layout.tsx
git commit -m "fix: add suppressHydrationWarning to B2B layout body tags to resolve hydration mismatch"
```
