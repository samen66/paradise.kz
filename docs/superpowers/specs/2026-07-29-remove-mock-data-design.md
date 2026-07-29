# Remove Mock Data & Implement Backend Support Design

## 1. Overview
The goal is to remove hardcoded mock data (`MOCK_SHOWROOMS`, `MOCK_SHORTS`, `MOCK_REVIEWS`, `mockRating`) from the Next.js storefront (B2C and B2B) and replace them with real data fetched from the Laravel backend. Since the backend does not currently support reviews and shorts, we will build out these backend features first, and then integrate them into the frontend.

## 2. Architecture & Components

### 2.1. Product Reviews
- **Database:**
  - Create `product_reviews` table: `id`, `product_id`, `user_id` (nullable for guest reviews if allowed, though MVP might require auth or just allow name), `name` (string, for guests), `rating` (tinyint 1-5), `comment` (text), `is_approved` (boolean, default false), `created_at`, `updated_at`.
- **Backend Models:**
  - `ProductReview` model.
  - Add `reviews()` `hasMany` relationship to `Product` model.
- **Backend API:**
  - In `ProductResource`, include `reviews` array (only approved reviews) and calculate `rating` (average of approved reviews) and `reviews_count`.
  - Create a new endpoint `POST /api/public/products/{product}/reviews` to submit new reviews.
- **Admin Panel (Filament):**
  - Create `ProductReviewResource` to allow admins to view, approve, and delete reviews.

### 2.2. Product Shorts (Video)
- **Database:**
  - Create `product_shorts` table: `id`, `product_id`, `video_url` (string), `thumbnail_url` (string, nullable), `title` (string, nullable), `sort_order` (integer, default 0), `created_at`, `updated_at`.
- **Backend Models:**
  - `ProductShort` model.
  - Add `shorts()` `hasMany` relationship to `Product` model.
- **Backend API:**
  - In `ProductResource`, include `shorts` array ordered by `sort_order`.
- **Admin Panel (Filament):**
  - Create a RelationManager inside the `ProductResource` (or a repeater field if we don't use a separate model, but a separate model + RelationManager is cleaner for a `hasMany` relationship) to allow admins to add Shorts to a product.

### 2.3. Showrooms Availability
- **Database:**
  - We already have `stores` and `product_store_stocks`.
- **Backend API:**
  - Update `ProductResource` to include a `showrooms` array. It will map over the product's `storeStocks` (which needs to be eager-loaded along with `store`). Each item will contain the store's name, address, and the available stock quantity.
- **Admin Panel:**
  - No changes needed, stores and stocks are already synced from MoySklad.

### 2.4. Frontend (Next.js)
- **Removal of Mocks:**
  - Remove `MOCK_SHOWROOMS`, `MOCK_SHORTS`, `MOCK_REVIEWS`, `mockRating` constants.
- **Data Integration:**
  - Update `ProductReviews.tsx` to use the `reviews` array from the API response. Add a form to submit a new review via the new POST endpoint.
  - Update `ShortsFeed.tsx` and `ProductShorts.tsx` to render videos from the `shorts` array in the API response.
  - Update `ShowroomAvailability.tsx` to render the `showrooms` array from the API response.
  - Update `CatalogView.tsx` to use the real `rating` and `reviews_count` from the product API response.

## 3. Data Flow
1. **Admin/MoySklad -> Backend:** Stock is synced from MoySklad. Admins manually add Shorts and approve Reviews in Filament.
2. **Backend -> Frontend:** The Next.js frontend calls `GET /api/public/products/{slug}` and receives a unified JSON payload containing the product details, active shorts, approved reviews, average rating, and per-showroom stock.
3. **Frontend -> Backend:** A user submits a review via `POST /api/public/products/{slug}/reviews`. The backend saves it as unapproved.

## 4. Testing & Verification
- Test that submitting a review works and it doesn't appear until approved in Filament.
- Test that Shorts added in Filament appear on the product page.
- Test that store stocks correctly map to the showrooms availability component.
- Ensure all TypeScript types are updated on the frontend to match the new API response structure.
