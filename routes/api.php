<?php

use App\Http\Controllers\Api\Account\FavoriteController;
use App\Http\Controllers\Api\Account\OrderController as AccountOrderController;
use App\Http\Controllers\Api\Account\ProfileController;
use App\Http\Controllers\Api\AddressController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\MoySkladWebhookController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\Public\CartController;
use App\Http\Controllers\Api\Public\CategoryController as PublicCategoryController;
use App\Http\Controllers\Api\Public\CheckoutController;
use App\Http\Controllers\Api\Public\FacetController;
use App\Http\Controllers\Api\Public\HomeController;
use App\Http\Controllers\Api\Public\OrderTrackingController;
use App\Http\Controllers\Api\Public\OtpAuthController;
use App\Http\Controllers\Api\Public\PageController;
use App\Http\Controllers\Api\Public\ProductController as PublicProductController;
use App\Http\Controllers\Api\Public\SettingsController;
use App\Http\Controllers\Api\Public\SitemapController;
use App\Http\Controllers\Api\StoreController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// MoySklad calls this directly, so it is intentionally unauthenticated and
// instead guarded by a shared secret inside the controller.
Route::post('/moysklad/webhook', MoySkladWebhookController::class);

Route::post('/kaspi/webhook', \App\Http\Controllers\Api\Public\KaspiWebhookController::class);

// Public: registration needs the warehouse list before the client has a token.
Route::get('/stores', [StoreController::class, 'index']);

Route::prefix('auth')->group(function () {
    // Self-registration is temporarily disabled for the 2026-07-02 release;
    // admins create B2B accounts manually in Filament until it returns.
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

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
    Route::get('/products/{product}', [ProductController::class, 'show']);

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
    Route::get('/categories', [PublicCategoryController::class, 'index']);
    Route::get('/categories/{slug}', [PublicCategoryController::class, 'show']);
    Route::get('/products', [PublicProductController::class, 'index']);
    // {product} is a slug or a numeric id — resolved in the controller.
    Route::get('/products/{product}', [PublicProductController::class, 'show']);
    Route::get('/facets', FacetController::class);

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

    // Same self-scoped controller the B2B portal uses.
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::patch('/addresses/{address}', [AddressController::class, 'update']);
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);

    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::put('/favorites/{product}', [FavoriteController::class, 'store']);
    Route::delete('/favorites/{product}', [FavoriteController::class, 'destroy']);
});
