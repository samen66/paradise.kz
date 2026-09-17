<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CatalogGroup;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Membership only: a group restricts an existing assortment to existing
 * clients, so nothing is created from here — just attached or detached.
 */
class CatalogGroupMemberController extends Controller
{
    public function attachProduct(CatalogGroup $catalogGroup, Product $product): JsonResponse
    {
        $catalogGroup->products()->syncWithoutDetaching([$product->id]);

        return response()->json(null, 204);
    }

    public function detachProduct(CatalogGroup $catalogGroup, Product $product): JsonResponse
    {
        $catalogGroup->products()->detach($product->id);

        return response()->json(null, 204);
    }

    public function attachUser(CatalogGroup $catalogGroup, User $user): JsonResponse
    {
        if (! $user->hasRole('b2b_customer')) {
            return response()->json(['message' => 'В группу каталога можно добавить только B2B-клиента.'], 422);
        }

        $catalogGroup->users()->syncWithoutDetaching([$user->id]);

        return response()->json(null, 204);
    }

    public function detachUser(CatalogGroup $catalogGroup, User $user): JsonResponse
    {
        $catalogGroup->users()->detach($user->id);

        return response()->json(null, 204);
    }
}
