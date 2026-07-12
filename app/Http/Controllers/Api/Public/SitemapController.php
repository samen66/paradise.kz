<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Page;
use App\Services\Catalog\VisibilityService;
use Illuminate\Http\JsonResponse;

/**
 * Lightweight URL inventory for the storefront's sitemap.xml generator
 * (Next.js `sitemap.ts` consumes this and renders per-locale alternates).
 * Only publicly visible entries are listed.
 */
class SitemapController extends Controller
{
    public function __construct(
        private readonly VisibilityService $visibility,
    ) {}

    public function __invoke(): JsonResponse
    {
        $products = $this->visibility->publicProductQuery()
            ->whereNotNull('slug')
            ->orderBy('id')
            ->get(['slug', 'updated_at'])
            ->map(fn ($product): array => [
                'type' => 'product',
                'slug' => $product->slug,
                'updated_at' => $product->updated_at?->toIso8601String(),
            ]);

        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['slug', 'updated_at'])
            ->map(fn ($category): array => [
                'type' => 'category',
                'slug' => $category->slug,
                'updated_at' => $category->updated_at?->toIso8601String(),
            ]);

        $pages = Page::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['slug', 'updated_at'])
            ->map(fn ($page): array => [
                'type' => 'page',
                'slug' => $page->slug,
                'updated_at' => $page->updated_at?->toIso8601String(),
            ]);

        return response()->json([
            'data' => $products->concat($categories)->concat($pages)->values()->all(),
        ]);
    }
}
