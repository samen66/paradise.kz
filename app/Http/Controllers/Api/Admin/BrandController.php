<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(): JsonResponse
    {
        $brands = Brand::orderBy('id', 'desc')->get();
        return response()->json($brands);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|array',
            'name.ru' => 'required|string|max:255',
            'name.kk' => 'nullable|string|max:255',
            'slug' => 'required|string|max:255|unique:brands,slug',
            'is_active' => 'boolean',
        ]);

        $brand = Brand::create($validated);

        return response()->json($brand, 201);
    }

    public function update(Request $request, Brand $brand): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|array',
            'name.ru' => 'required|string|max:255',
            'name.kk' => 'nullable|string|max:255',
            'slug' => 'required|string|max:255|unique:brands,slug,' . $brand->id,
            'is_active' => 'boolean',
        ]);

        $brand->update($validated);

        return response()->json($brand);
    }

    public function destroy(Brand $brand): JsonResponse
    {
        $brand->delete();
        return response()->json(null, 204);
    }
}
