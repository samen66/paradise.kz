<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttributeRequest;
use App\Models\Attribute;
use Illuminate\Http\JsonResponse;

class AttributeController extends Controller
{
    public function index(): JsonResponse
    {
        $attributes = Attribute::query()->get()
            ->sortBy(fn (Attribute $attribute): string => mb_strtolower($attribute->getTranslation('name', 'ru')))
            ->values();

        return response()->json(['data' => $attributes]);
    }

    public function store(AttributeRequest $request): JsonResponse
    {
        return response()->json(['data' => Attribute::create($request->validated())], 201);
    }

    public function show(Attribute $attribute): JsonResponse
    {
        return response()->json(['data' => $attribute]);
    }

    public function update(AttributeRequest $request, Attribute $attribute): JsonResponse
    {
        $attribute->update($request->validated());

        return response()->json(['data' => $attribute]);
    }

    /**
     * Deleting would cascade away every product's value for it — a manager
     * clears the values first, on purpose.
     */
    public function destroy(Attribute $attribute): JsonResponse
    {
        if ($attribute->values()->exists()) {
            return response()->json(['message' => 'Атрибут используется в товарах — сначала удалите его значения.'], 422);
        }

        $attribute->delete();

        return response()->json(null, 204);
    }
}
