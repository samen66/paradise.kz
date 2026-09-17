<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CatalogGroupRequest;
use App\Models\CatalogGroup;
use Illuminate\Http\JsonResponse;

class CatalogGroupController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => CatalogGroup::withCount(['products', 'users'])->orderBy('name')->get(),
        ]);
    }

    public function store(CatalogGroupRequest $request): JsonResponse
    {
        return response()->json(['data' => CatalogGroup::create($request->validated())], 201);
    }

    public function show(CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->load([
            'products' => fn ($query) => $query->select('products.id', 'products.name', 'products.code', 'products.article')->orderBy('products.id'),
            'users' => fn ($query) => $query->select('users.id', 'users.company_name', 'users.email', 'users.phone')->orderBy('users.company_name'),
        ]);

        return response()->json(['data' => $catalogGroup]);
    }

    public function update(CatalogGroupRequest $request, CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->update($request->validated());

        return response()->json(['data' => $catalogGroup]);
    }

    public function destroy(CatalogGroup $catalogGroup): JsonResponse
    {
        $catalogGroup->delete();

        return response()->json(null, 204);
    }
}
