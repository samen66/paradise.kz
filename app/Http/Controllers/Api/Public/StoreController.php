<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\JsonResponse;

class StoreController extends Controller
{
    public function index(): JsonResponse
    {
        $stores = Store::where('is_active', true)
            ->get(['id', 'name', 'address', 'city', 'working_hours', 'phone']);

        return response()->json([
            'data' => $stores
        ]);
    }
}
