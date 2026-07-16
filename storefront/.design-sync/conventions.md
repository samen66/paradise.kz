## Paradise.kz storefront components

These are the real components from a Next.js furniture-storefront app (Kazakhstan market, Russian/Kazakh copy). They're plain client components — no CSS-in-JS, all styling is Tailwind v4 utility classes against this app's own token palette.

### Wrapping and setup

Most components read translated strings via next-intl (`useTranslations`/`useLocale`) and some read router state (`usePathname`/`useSearchParams`). Wrap any composition that uses these — `LocaleSwitcher`, `SortSelect`, `MegaMenu`, `BurgerDrawer`, `HeaderBurger`, `FilterSidebar`, `ActiveFilters`, `Pagination`, `SearchBox`, `CategoryIcons`, `B2BHeader`, `B2BFooter` are the ones that do — in `PreviewProviders`, a real export on the bundle:

```jsx
<ParadiseStorefront.PreviewProviders>
  <ParadiseStorefront.SortSelect value="popular" onChange={() => {}} />
</ParadiseStorefront.PreviewProviders>
```

Without it, a component that calls `useTranslations()` throws immediately. Purely presentational components (`Button`, `Badge`, `Chip`, `Input`, `ProductCard`, `Skeleton`) don't need it.

Overlay components (`Modal`, `Drawer`, `ToastContainer`) render via `position: fixed` — compose them inside a container that has real height (not just `min-h-0` auto content), or the fixed element has nothing to anchor against.

### Styling idiom

Tailwind v4, CSS-first tokens (`@theme` in `styles.css`). Use these families — not raw hex or arbitrary values:

| Token | Use |
|---|---|
| `bg-surface` | page background (warm off-white) |
| `bg-panel` | cream hero / accent panels |
| `bg-card` | product photo backdrop |
| `text-ink` / `bg-ink` | primary text, dark buttons (never pure black) |
| `text-muted` | secondary / label text |
| `border-line` / `border-line-strong` | dividers and borders |
| `bg-mint` / `text-mint-ink` | "in stock" / new-arrival badges |
| `bg-sale` / `text-sale-ink` | discount badges |
| `font-sans` | body text — Golos Text |
| `font-display` | headings, emphasis — Manrope |

Radii and shape follow existing components: `rounded-full` for buttons/chips/badges, `rounded-xl`/`rounded-2xl` for cards, panels, modals, drawers. Borders are `border border-line` at 1px, never heavier.

### Where the truth lives

Read `styles.css` (imports the compiled `_ds_bundle.css` — the real Tailwind output, not just token declarations) and each component's `.prompt.md` before composing with it. Props come from the shipped `.d.ts` files — trust those over guessing.

### Example composition

```jsx
<ParadiseStorefront.PreviewProviders>
  <div className="rounded-2xl border border-line bg-white p-4">
    <ProductCard product={{ title: "Диван Milan прямой", price: 389900, sku: "MIL-3S-GRY", inStock: 6 }} />
    <div className="mt-3 flex items-center justify-between">
      <ParadiseStorefront.Badge variant="sale">-20%</ParadiseStorefront.Badge>
      <ParadiseStorefront.Button variant="primary">В корзину</ParadiseStorefront.Button>
    </div>
  </div>
</ParadiseStorefront.PreviewProviders>
```

Content should be realistic Russian furniture-retail copy (product names, prices in ₸, category names) — not placeholder text — to match how this DS is actually used.
