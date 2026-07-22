## Paradise.kz storefront components

These are the real components from a Next.js furniture-storefront app (Kazakhstan market, Russian/Kazakh copy). They're plain client components — no CSS-in-JS, all styling is Tailwind v4 utility classes against this app's own token palette.

### Wrapping and setup

Most components read translated strings via next-intl (`useTranslations`/`useLocale`) and/or use the app's `Link`/`useRouter`/`usePathname` from `@/i18n/navigation` (next-intl's routing, which itself reads the current locale from context). Wrap any composition that uses these — `AccountLink`, `ActiveFilters`, `AddToCartButton`, `BannerCarousel`, `BurgerDrawer`, `CartBadge`, `CategoryIcons`, `FavoriteButton`, `FilterSidebar`, `HeaderBurger` (renders `BurgerDrawer` internally), `InStockChip`, `LocaleSwitcher`, `MegaMenu`, `Pagination`, `ProductCard`, `SearchBox`, `SortSelect`, `B2BCatalogView` are the ones that do — in `PreviewProviders`, a real export on the bundle:

```jsx
<ParadiseStorefront.PreviewProviders>
  <ParadiseStorefront.SortSelect value="popular" onChange={() => {}} />
</ParadiseStorefront.PreviewProviders>
```

Without it, a component that calls `useTranslations()`/`useLocale()` (directly, or transitively via `@/i18n/navigation`'s `Link`) throws immediately. Purely presentational components (`Badge`, `Button`, `Chip`, `Input`, `Modal`, `Drawer`, `ToastContainer`, `Skeleton`, `Carousel`, `ProductGallery`) don't need it — nor do the three B2B components that use plain `next/link` instead of the i18n-aware one (`AddToCartB2BButton`, `B2BHeader`, `B2BFooter`).

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
  <div className="max-w-xs">
    <ParadiseStorefront.ProductCard
      product={{
        id: 101, external_id: "sofa-milan-3s", name: "Диван Milan прямой, 3-местный",
        slug: "divan-milan-3-mestnyy", code: "SOF-101", article: "MIL-3S-GRY",
        category_id: 12, brand: { id: 4, name: "Ambianta", slug: "ambianta" },
        images: [], image: "https://picsum.photos/seed/sofa/600/600",
        stock: 6, in_stock: true, price: 389900, old_price: 459900,
        country: "Казахстан", supplier: "Ambianta Furniture", barcodes: [], attributes: {},
      }}
    />
  </div>
</ParadiseStorefront.PreviewProviders>
```

`ProductCard` takes the full `Product` shape (see its `.d.ts` / `.prompt.md`) — not a flattened `{title, price, sku}`-style object; it reads `product.name`/`product.price`/`product.stock`/`product.in_stock`/`product.old_price`/`product.is_new` directly. Content should be realistic Russian furniture-retail copy (product names, prices in ₸, category names) — not placeholder text — to match how this DS is actually used.
