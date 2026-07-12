<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicCategoryResource;
use App\Models\Category;
use App\Services\Catalog\CategoryTree;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    public function __construct(
        private readonly CategoryTree $tree,
    ) {}

    /**
     * Flat list of active local categories. The frontend rebuilds the tree
     * client-side from `parent_id`.
     */
    public function index(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return PublicCategoryResource::collection($categories);
    }

    /**
     * Category detail for the storefront listing page: SEO meta, active
     * children and the breadcrumb chain. Addressable by slug.
     */
    public function show(string $slug): PublicCategoryResource
    {
        $category = Category::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $category->load(['children' => function ($query): void {
            $query->where('is_active', true)->orderBy('sort_order');
        }]);

        $category->with_detail = true;
        $category->breadcrumb_chain = collect($this->tree->breadcrumb($category));

        return new PublicCategoryResource($category);
    }
}
