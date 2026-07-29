<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ProductReviewController extends Controller
{
    public function store(Request $request, string $product): JsonResponse
    {
        $productModel = $this->findBySlugOrId($product);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string',
        ]);

        $productModel->reviews()->create([
            'name' => $validated['name'],
            'rating' => $validated['rating'],
            'comment' => $validated['comment'],
            'is_approved' => false,
            'user_id' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Review submitted successfully.'], Response::HTTP_CREATED);
    }

    private function findBySlugOrId(string $key): Product
    {
        $query = Product::query()->where('slug', $key);

        if (ctype_digit($key)) {
            $query->orWhere('id', (int) $key);
        }

        return $query->firstOrFail();
    }
}
