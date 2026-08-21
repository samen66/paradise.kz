# Design: Admin Categories and Brands CRUD

## 1. Context and Goals
The objective is to implement simple CRUD operations for `Category` and `Brand` models in the Next.js admin panel and Laravel API. This includes:
- API endpoints in Laravel for both entities under the `admin` middleware group.
- Shared Sidebar navigation in Next.js to access these sections.
- Tables with inline Modals for Create and Edit actions, providing a smooth UX without full page reloads.

## 2. Laravel API Design
- **Category API**: `Route::apiResource('categories', Api\Admin\CategoryController::class);`
- **Brand API**: `Route::apiResource('brands', Api\Admin\BrandController::class);`
- **Payloads**: Both models use Spatie Translatable for the `name` field. The API expects `name` as an object: `{"ru": "...", "kk": "..."}`.
- **Fields**:
  - Category: `name` (translatable), `slug`, `parent_id`, `is_active`
  - Brand: `name` (translatable), `slug`, `is_active`

## 3. Next.js UI Design
- **Layout**: Update `admin/src/app/layout.tsx` (or a dedicated `AdminLayout` wrapper) to include a Sidebar containing links to: "Товары" (`/products`), "Категории" (`/categories`), and "Бренды" (`/brands`).
- **Pages**:
  - `admin/src/app/categories/page.tsx`
  - `admin/src/app/brands/page.tsx`
- **CRUD Components**:
  - Main table displaying ID, Name (RU), Slug, and Status.
  - "Добавить" button opening a Modal with a form.
  - "Редактировать" button per row opening a Modal pre-filled with the entity data.
  - Delete button with confirmation.
- **State Management**: Local state for the modal visibility and the "currently editing" item. SWR or simple `fetch` for data loading and refetching on mutate.
