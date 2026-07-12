<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\CatalogSetting;
use App\Models\Store;
use Illuminate\Http\JsonResponse;

/**
 * Storefront-wide settings for the header/footer/checkout: delivery pricing
 * and store contacts. Prices are exposed in major units (₸) like the rest of
 * the public API.
 */
class SettingsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $settings = CatalogSetting::current();

        $stores = Store::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => [
                'delivery_price' => $settings->delivery_price === null ? null : $settings->delivery_price / 100,
                'free_delivery_from' => $settings->free_delivery_from === null ? null : $settings->free_delivery_from / 100,
                'contacts' => [
                    'phone' => $settings->contact_phone,
                    'email' => $settings->contact_email,
                    'address' => $settings->contact_address,
                    'whatsapp_url' => $settings->whatsapp_url,
                    'instagram_url' => $settings->instagram_url,
                ],
                'stores' => StoreResource::collection($stores),
            ],
        ]);
    }
}
