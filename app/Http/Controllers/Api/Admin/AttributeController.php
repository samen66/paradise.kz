<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AttributeRequest;
use App\Models\Attribute;
use App\Support\Translations;
use App\Support\UniqueSlug;
use Illuminate\Http\JsonResponse;

class AttributeController extends Controller
{
    /**
     * Usage counters every response carries, for the attributes screen.
     *
     * @var list<string>
     */
    private const COUNTS = ['values'];

    public function index(): JsonResponse
    {
        $attributes = Attribute::query()->withCount(self::COUNTS)->get()
            ->sortBy(fn (Attribute $attribute): string => mb_strtolower($attribute->getTranslation('name', 'ru')))
            ->values();

        return response()->json(['data' => $attributes]);
    }

    public function store(AttributeRequest $request): JsonResponse
    {
        $data = $request->validated();

        $attribute = new Attribute([
            'slug' => $data['slug'] ?? UniqueSlug::make('attributes', $data['name']['ru'], 'attribute'),
            'is_filterable' => $data['is_filterable'] ?? false,
        ]);
        $attribute->replaceTranslations('name', Translations::filled($data['name']));
        $attribute->save();

        return response()->json(['data' => $attribute->loadCount(self::COUNTS)], 201);
    }

    public function show(Attribute $attribute): JsonResponse
    {
        return response()->json(['data' => $attribute->loadCount(self::COUNTS)]);
    }

    public function update(AttributeRequest $request, Attribute $attribute): JsonResponse
    {
        $data = $request->validated();

        $attribute->replaceTranslations('name', Translations::filled($data['name']));

        if (($data['slug'] ?? null) !== null) {
            $attribute->slug = $data['slug'];
        }

        if (array_key_exists('is_filterable', $data)) {
            $attribute->is_filterable = $data['is_filterable'];
        }

        $attribute->save();

        return response()->json(['data' => $attribute->loadCount(self::COUNTS)]);
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
