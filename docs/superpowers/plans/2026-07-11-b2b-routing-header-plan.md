# B2B Routing and Header Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the B2B routing collision by renaming the route group folder and add a "Стать партнером" link to the global header to route wholesale clients to the B2B portal.

**Architecture:** Rename the Next.js Route Group `(b2b)` to a standard directory `b2b`. Modify the global Header component to include a highlighted direct link to `/b2b/login`.

**Tech Stack:** Next.js (App Router), Tailwind CSS.

## Global Constraints

- Do not change anything in `next-intl` configuration or `middleware.ts`.
- The new link must bypass `next-intl` localization logic by navigating to `/b2b/login` natively without a locale prefix.

---

### Task 1: Rename Route Group to Standard Directory

**Files:**
- Rename: `storefront/src/app/(b2b)` -> `storefront/src/app/b2b`

**Interfaces:**
- Produces: Exposed routes at `/b2b/*` instead of `/*`.

- [ ] **Step 1: Rename the folder**

Run: `mv storefront/src/app/\(b2b\) storefront/src/app/b2b`
Expected: Folder successfully renamed.

- [ ] **Step 2: Commit**

```bash
git add -A storefront/src/app/b2b storefront/src/app/\(b2b\)
git commit -m "refactor: rename (b2b) route group to b2b for correct routing"
```

### Task 2: Add "Become a partner" Link to Header

**Files:**
- Modify: `storefront/src/components/Header.tsx`

**Interfaces:**
- Consumes: Standard React HTML anchor tag pointing to `/b2b/login`

- [ ] **Step 1: Add the link in the top utility bar**

Modify `storefront/src/components/Header.tsx`. Replace the current utility bar links:

```tsx
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink transition">{tNav("about")}</Link>
            <Link href="/delivery" className="hover:text-ink transition">{tNav("delivery")}</Link>
            <Link href="/contacts" className="hover:text-ink transition">{tNav("contacts")}</Link>
          </div>
```

With the new version that includes the "Стать партнером" link using a standard `<a>` tag to avoid `next-intl` locale prefixing:

```tsx
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink transition">{tNav("about")}</Link>
            <Link href="/delivery" className="hover:text-ink transition">{tNav("delivery")}</Link>
            <Link href="/contacts" className="hover:text-ink transition">{tNav("contacts")}</Link>
            <a href="/b2b/login" className="font-medium text-ink hover:opacity-70 transition">Стать партнером</a>
          </div>
```

- [ ] **Step 2: Commit**

```bash
git add storefront/src/components/Header.tsx
git commit -m "feat: add B2B portal link to top utility bar"
```
