<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StoreController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return StoreResource::collection(
            Store::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('name')->get(),
        );
    }
}
