<?php

use App\Http\Controllers\Api\Account\FavoriteController;
use App\Http\Controllers\Api\Account\OrderController as AccountOrderController;
use App\Http\Controllers\Api\Account\ProfileController;
use App\Http\Controllers\Api\AddressController;
use App\Http\Controllers\Api\Admin\AttributeController;
use App\Http\Controllers\Api\Admin\AttributeValueController;
use App\Http\Controllers\Api\Admin\BrandController;
use App\Http\Controllers\Api\Admin\CatalogGroupController;
use App\Http\Controllers\Api\Admin\CatalogGroupMemberController;
use App\Http\Controllers\Api\Admin\ClientProductPriceController;
use App\Http\Controllers\Api\Admin\GoodsReceiptController;
use App\Http\Controllers\Api\Admin\GoodsReceiptItemController;
use App\Http\Controllers\Api\Admin\PriceTypeController;
use App\Http\Controllers\Api\Admin\ProductCollectionController;
use App\Http\Controllers\Api\Admin\ProductCollectionProductController;
use App\Http\Controllers\Api\Admin\ProductMediaController;
use App\Http\Controllers\Api\Admin\ProductPriceController;
use App\Http\Controllers\Api\Admin\ProductVariantController;
use App\Http\Controllers\Api\Admin\StockController;
use App\Http\Controllers\Api\Admin\StockMovementController;
use App\Http\Controllers\Api\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\Admin\SupplierController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\WriteOffController;
use App\Http\Controllers\Api\Admin\WriteOffItemController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\PhoneAuthController;
use App\Http\Controllers\Api\CartController as B2bCartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\Public\CartController;
use App\Http\Controllers\Api\Public\CategoryController as PublicCategoryController;
use App\Http\Controllers\Api\Public\CheckoutController;
use App\Http\Controllers\Api\Public\FacetController;
use App\Http\Controllers\Api\Public\HomeController;
use App\Http\Controllers\Api\Public\KaspiWebhookController;
use App\Http\Controllers\Api\Public\OrderTrackingController;
use App\Http\Controllers\Api\Public\OtpAuthController;
use App\Http\Controllers\Api\Public\PageController;
use App\Http\Controllers\Api\Public\ProductController as PublicProductController;
use App\Http\Controllers\Api\Public\ProductReviewController;
use App\Http\Controllers\Api\Public\SettingsController;
use App\Http\Controllers\Api\Public\SitemapController;
use App\Http\Controllers\Api\Public\StoreController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/kaspi/webhook', KaspiWebhookController::class);

Route::prefix('auth')->group(function () {
    // Self-registration is temporarily disabled for the 2026-07-02 release;
    // admins create B2B accounts manually in Filament until it returns.
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    // B2B portal: phone + SMS code. Throttled per IP on top of the per-phone
    // limits inside OtpService.
    Route::post('/otp/request', [PhoneAuthController::class, 'request'])->middleware('throttle:5,1');
    Route::post('/otp/register', [PhoneAuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/otp/login', [PhoneAuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::patch('/settings', [AuthController::class, 'updateSettings']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    // Placeholder demonstrating the approval gate; real catalog/order routes
    // adopt the same ['auth:sanctum', 'approved'] stack in later tasks.
    Route::get('/ping', fn () => response()->json(['ok' => true]))
        ->middleware(['auth:sanctum', 'approved']);
});

// Catalog + orders: visible only to authenticated, approved B2B clients.
// `b2b` matters: retail (storefront) accounts are auto-approved, so without
// it a retail token could read wholesale prices.
Route::middleware(['auth:sanctum', 'approved', 'b2b'])->group(function () {
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/products', [ProductController::class, 'index']);
    // Numeric id only: slugs are the public storefront's addressing. Without
    // the constraint MySQL would cast '3-kreslo' to 3 and resolve product 3.
    Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');

    Route::post('/cart/validate', [B2bCartController::class, 'validateCart']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);

    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::patch('/addresses/{address}', [AddressController::class, 'update']);
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);
});

// B2C storefront: fully anonymous — no login, no approval gate, retail
// pricing, only the public (ungrouped) catalog. See VisibilityService and
// OrderPlacementService::placeGuest().
Route::prefix('public')->group(function () {
    Route::get('/stores', [StoreController::class, 'index']);
    Route::get('/categories', [PublicCategoryController::class, 'index']);
    Route::get('/categories/{slug}', [PublicCategoryController::class, 'show']);
    Route::get('/products', [PublicProductController::class, 'index']);
    // {product} is a slug or a numeric id — resolved in the controller.
    Route::get('/products/{product}', [PublicProductController::class, 'show']);
    Route::get('/facets', FacetController::class);
    Route::post('/products/{product}/reviews', [ProductReviewController::class, 'store']);

    Route::get('/home', HomeController::class);
    Route::get('/pages', [PageController::class, 'index']);
    Route::get('/pages/{slug}', [PageController::class, 'show']);
    Route::get('/settings', SettingsController::class);
    Route::get('/sitemap', SitemapController::class);

    Route::post('/cart/validate', [CartController::class, 'validateCart']);
    Route::post('/checkout', [CheckoutController::class, 'store']);

    // B2C login: phone + SMS code. Throttled per IP on top of the per-phone
    // limits inside OtpService.
    Route::post('/auth/otp/request', [OtpAuthController::class, 'request'])->middleware('throttle:5,1');
    Route::post('/auth/otp/verify', [OtpAuthController::class, 'verify'])->middleware('throttle:10,1');

    // Guest order tracking (number + phone must both match).
    Route::get('/orders/track', OrderTrackingController::class)->middleware('throttle:10,1');
});

// Storefront customer account: ownership-scoped, any authenticated token
// (retail after OTP login; B2B tokens work too since everything is self-only).
Route::prefix('account')->middleware('auth:sanctum')->group(function () {
    Route::get('/me', [ProfileController::class, 'me']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::post('/logout', [ProfileController::class, 'logout']);

    Route::get('/orders', [AccountOrderController::class, 'index']);
    Route::get('/orders/{order}', [AccountOrderController::class, 'show']);
    Route::patch('/orders/{order}/cancel', [AccountOrderController::class, 'cancel']);

    // Same self-scoped controller the B2B portal uses.
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::patch('/addresses/{address}', [AddressController::class, 'update']);
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);

    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::put('/favorites/{product}', [FavoriteController::class, 'store']);
    Route::delete('/favorites/{product}', [FavoriteController::class, 'destroy']);
});

// Admin Panel API
Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:admin|manager'])
    ->group(function () {
        Route::apiResource('products', App\Http\Controllers\Api\Admin\ProductController::class);
        Route::get('products/{product}/media', [ProductMediaController::class, 'index']);
        Route::post('products/{product}/media', [ProductMediaController::class, 'store']);
        Route::put('products/{product}/media/order', [ProductMediaController::class, 'order']);
        Route::delete('products/{product}/media/{media}', [ProductMediaController::class, 'destroy'])->scopeBindings();
        Route::apiResource('categories', App\Http\Controllers\Api\Admin\CategoryController::class);
        Route::apiResource('brands', BrandController::class);
        Route::apiResource('attributes', AttributeController::class);
        Route::apiResource('price-types', PriceTypeController::class);
        Route::apiResource('catalog-groups', CatalogGroupController::class);
        Route::post('catalog-groups/{catalog_group}/products/{product}', [CatalogGroupMemberController::class, 'attachProduct']);
        Route::delete('catalog-groups/{catalog_group}/products/{product}', [CatalogGroupMemberController::class, 'detachProduct']);
        Route::post('catalog-groups/{catalog_group}/users/{user}', [CatalogGroupMemberController::class, 'attachUser']);
        Route::delete('catalog-groups/{catalog_group}/users/{user}', [CatalogGroupMemberController::class, 'detachUser']);
        Route::apiResource('product-collections', ProductCollectionController::class);
        Route::put('product-collections/{product_collection}/products/{product}', [ProductCollectionProductController::class, 'upsert']);
        Route::delete('product-collections/{product_collection}/products/{product}', [ProductCollectionProductController::class, 'destroy']);
        // Relations of a product; a child of another product answers 404.
        Route::apiResource('products.prices', ProductPriceController::class)->except('show')->scoped();
        Route::apiResource('products.client-prices', ClientProductPriceController::class)->except('show')->scoped();
        Route::apiResource('products.attribute-values', AttributeValueController::class)->except('show')->scoped();
        Route::apiResource('products.variants', ProductVariantController::class)->except('show')->scoped();
        Route::apiResource('orders', App\Http\Controllers\Api\Admin\OrderController::class)->only(['index', 'show', 'update']);
        // Read-only: stock moves through goods receipts / adjustments so that
        // every change is recorded in the ledger.
        Route::get('stock', [StockController::class, 'index']);
        Route::get('stock-movements', [StockMovementController::class, 'index']);
        Route::apiResource('suppliers', SupplierController::class);
        Route::apiResource('stores', AdminStoreController::class);
        Route::apiResource('goods-receipts', GoodsReceiptController::class);
        Route::post('goods-receipts/{goods_receipt}/post', [GoodsReceiptController::class, 'post']);
        Route::apiResource('goods-receipts.items', GoodsReceiptItemController::class)->except('show')->scoped();
        Route::apiResource('write-offs', WriteOffController::class);
        Route::post('write-offs/{write_off}/post', [WriteOffController::class, 'post']);
        Route::apiResource('write-offs.items', WriteOffItemController::class)->except('show')->scoped();
        Route::get('users', [UserController::class, 'index']);
        Route::post('users/{user}/approve', [UserController::class, 'approve']);
    });
