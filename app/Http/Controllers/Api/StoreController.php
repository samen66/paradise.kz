<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StoreController extends Controller
{
    /**
     * Public list of warehouses clients may pick from (registration happens
     * before authentication, so this endpoint carries no auth gate).
     */
    public function index(): AnonymousResourceCollection
    {
        $stores = Store::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return StoreResource::collection($stores);
    }
}
