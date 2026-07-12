<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Page;
use Illuminate\Http\JsonResponse;

/**
 * Static storefront content pages (about, delivery, contacts, ...), authored
 * in Filament. Localized via SetApiLocale like the rest of the public API.
 */
class PageController extends Controller
{
    public function index(): JsonResponse
    {
        $pages = Page::query()
            ->where('is_active', true)
            ->orderBy('slug')
            ->get(['id', 'slug', 'title']);

        return response()->json([
            'data' => $pages->map(fn (Page $page): array => [
                'slug' => $page->slug,
                'title' => $page->title,
            ])->all(),
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $page = Page::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'data' => [
                'slug' => $page->slug,
                'title' => $page->title,
                'body' => $page->body,
                'seo_title' => $page->seo_title,
                'seo_description' => $page->seo_description,
                'updated_at' => $page->updated_at?->toIso8601String(),
            ],
        ]);
    }
}
