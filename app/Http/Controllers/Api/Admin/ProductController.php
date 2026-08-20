<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index()
    {
        $products = QueryBuilder::for(Product::class)
            ->allowedFilters([
                AllowedFilter::exact('category_id'),
                AllowedFilter::exact('is_active'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('name->ru', 'LIKE', "%{$value}%")
                          ->orWhere('name->kk', 'LIKE', "%{$value}%")
                          ->orWhere('code', 'LIKE', "%{$value}%");
                    });
                }),
            ])
            ->with(['category', 'brand', 'media', 'externalMapping'])
            ->paginate(15);

        return response()->json($products);
    }

    public function show($id)
    {
        $product = Product::with(['category', 'brand', 'media', 'externalMapping'])->findOrFail($id);
        return response()->json(['data' => $product]);
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        
        $validated = $request->validate([
            'name' => 'required|array',
            'name.ru' => 'required|string|max:255',
            'name.kk' => 'nullable|string|max:255',
            'description' => 'nullable|array',
            'description.ru' => 'nullable|string',
            'description.kk' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'retail_price' => 'nullable|integer|min:0',
            'b2b_price' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
            'is_new_arrival' => 'boolean',
            'images' => 'nullable|array',
            'images.*' => 'image|max:5120',
        ]);

        DB::transaction(function () use ($product, $validated, $request) {
            $product->update($validated);

            if ($request->hasFile('images')) {
                $product->clearMediaCollection(Product::IMAGE_COLLECTION ?? 'images');
                foreach ($request->file('images') as $image) {
                    $product->addMedia($image)->toMediaCollection(Product::IMAGE_COLLECTION ?? 'images');
                }
            }
        });

        return response()->json(['data' => $product->load(['media', 'category', 'brand'])]);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $product->delete();
        return response()->json(null, 204);
    }
}
