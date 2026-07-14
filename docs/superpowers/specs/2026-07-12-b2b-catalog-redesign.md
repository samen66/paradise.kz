# B2B Catalog UI/UX Redesign Specification

## Overview
Redesign the B2B catalog (`/b2b/catalog`) to follow modern UI/UX best practices while preserving the visual grid layout that aids product discovery. The focus is on a premium look and feel through subtle spacing, typography, hover interactions, and an improved filter layout.

## Goals & Decisions
1. **Overall Layout**: Modernized Visual Grid. We will retain the core layout (`ProductCard` grid + `FilterSidebar`) but elevate the aesthetics.
2. **Product Card**: Elevated & Interactive. Cards will feature soft lift animations and shadows on hover. Key B2B data (like minimum order quantity) will be highlighted with clear, color-tinted badges.
3. **Filter Sidebar**: Seamless & Soft. The sidebar will drop hard borders and blend smoothly into the page background, using typography hierarchy and custom styled checkboxes for organization.

## Architecture & Components

### 1. `ProductCard` (B2B Context)
- **Container**: Add a subtle background (`bg-white`).
- **Hover State**: Add `transition-all duration-300 hover:-translate-y-1 hover:shadow-lg` to the card container.
- **Image**: Maintain the current aspect ratio but ensure the padding allows the product to breathe. 
- **Badges**:
  - Convert the textual "Мин. заказ: X шт." into a modern chip component: `bg-mint/40 text-mint-ink px-2 py-0.5 rounded-full text-xs font-semibold`.
  - Update the "Опт" label to feel consistent with the chip style.
- **Add to Cart**: Ensure the button layout is clean and aligns properly at the bottom of the card.

### 2. `FilterSidebar`
- **Container Styling**: Remove the `border-line` border.
- **Typography**: Update section headers (`<summary>`) to feel more organized, perhaps using a consistent font weight and removing borders between sections.
- **Checkboxes**: Replace native inputs with custom CSS checkboxes (e.g., using Tailwind's `peer` utilities) that match the brand ink color, perhaps rounded squares instead of harsh sharp edges.
- **Mobile Drawer**: Ensure the "Seamless & Soft" concept translates to the mobile drawer.

### 3. `B2BCatalogView` (Layout Shell)
- **Header Section**: Refine the typography of the `<h1>` and the "found count". Ensure the description text has optimal line height (`leading-relaxed`) and color (`text-muted`).
- **Active Filters & Sort**: Update the active filter chips to look modern and pill-shaped, fitting cohesively with the overall soft layout.

## Data Flow & Error Handling
- No changes to backend data flow. Will continue using the existing `apiGet` calls.
- Maintain existing loading states but ensure they match the polished UI.

## Testing
- Ensure hover states perform smoothly without layout shift.
- Verify custom checkboxes work reliably on mobile Safari/Chrome.
- Ensure color contrast of new badges meets accessibility guidelines.
