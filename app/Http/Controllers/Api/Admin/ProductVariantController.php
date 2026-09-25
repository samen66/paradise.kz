<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductVariantRequest;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Catalog\AttributeValueSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class ProductVariantController extends Controller
{
    /** ERP bookkeeping kept as data, never shown in the admin. */
    private const HIDDEN = ['source', 'external_id', 'synced_at', 'characteristics'];

    /** Relations every response carries. */
    private const RELATIONS = ['attributeValues.attribute:id,name,slug', 'images'];

    public function index(Product $product): JsonResponse
    {
        $variants = $product->variants()->with(self::RELATIONS)->orderBy('id')->get();

        return response()->json(['data' => $variants->map(fn (ProductVariant $variant): array => $this->present($variant))->all()]);
    }

    public function store(ProductVariantRequest $request, Product $product, AttributeValueSync $sync): JsonResponse
    {
        $data = $request->validated();

        $variant = DB::transaction(function () use ($data, $product, $sync): ProductVariant {
            $variant = $product->variants()->create([
                ...Arr::except($data, ['attribute_values', 'media_ids']),
                // NOT NULL columns from the ERP days; a hand-made variant is local.
                'source' => 'local',
                'external_id' => (string) Str::uuid(),
            ]);
            $this->saveRelations($variant, $data, $sync);

            return $variant;
        });

        return response()->json(['data' => $this->present($variant)], 201);
    }

    public function update(ProductVariantRequest $request, Product $product, ProductVariant $variant, AttributeValueSync $sync): JsonResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $variant, $sync): void {
            $variant->update(Arr::except($data, ['attribute_values', 'media_ids']));
            $this->saveRelations($variant, $data, $sync);
        });

        return response()->json(['data' => $this->present($variant)]);
    }

    public function destroy(Product $product, ProductVariant $variant): JsonResponse
    {
        $variant->delete();

        return response()->json(null, 204);
    }

    /**
     * Keys absent from the request leave that relation as it is.
     *
     * @param  array<string, mixed>  $data
     */
    private function saveRelations(ProductVariant $variant, array $data, AttributeValueSync $sync): void
    {
        if (array_key_exists('attribute_values', $data)) {
            $sync->sync($variant, $data['attribute_values']);
        }

        if (array_key_exists('media_ids', $data)) {
            $variant->images()->sync(
                collect($data['media_ids'])
                    ->values()
                    ->mapWithKeys(fn (mixed $id, int $position): array => [(int) $id => ['sort_order' => $position]])
                    ->all(),
            );
        }
    }

    /**
     * The variant as the admin reads it; photos in the gallery's own shape.
     *
     * @return array<string, mixed>
     */
    private function present(ProductVariant $variant): array
    {
        $variant->load(self::RELATIONS)->makeHidden([...self::HIDDEN, 'images']);

        return [
            ...$variant->toArray(),
            'images' => $variant->images->map(fn (Media $media): array => ProductMediaController::present($media))->values()->all(),
        ];
    }
}
