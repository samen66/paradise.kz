<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\Category;
use Illuminate\Support\Collection;

/**
 * Small helpers over the local category tree (categories.parent_id). The tree
 * is tiny (admin-curated), so one SELECT of id/parent_id and an in-memory walk
 * beats recursive SQL and stays portable between MySQL and SQLite.
 */
class CategoryTree
{
    /**
     * Ids of the category identified by id or slug plus all of its
     * descendants. Empty when the category does not exist — callers filter
     * with whereIn, so "unknown category" naturally matches no products.
     *
     * @return list<int>
     */
    public function subtreeIds(string $idOrSlug): array
    {
        $categories = Category::query()->toBase()->get(['id', 'parent_id', 'slug']);

        $root = $categories->first(fn (object $category): bool => $category->slug === $idOrSlug
            || (ctype_digit($idOrSlug) && $category->id === (int) $idOrSlug));

        if ($root === null) {
            return [];
        }

        $childrenByParent = $categories->groupBy('parent_id');

        $ids = [];
        $queue = [$root->id];

        while ($queue !== []) {
            $id = array_shift($queue);
            $ids[] = $id;

            foreach ($childrenByParent->get($id, new Collection) as $child) {
                $queue[] = $child->id;
            }
        }

        return $ids;
    }

    /**
     * The chain from the root ancestor down to the given category (inclusive),
     * for storefront breadcrumbs.
     *
     * @return list<Category>
     */
    public function breadcrumb(Category $category): array
    {
        $chain = [$category];

        while ($category->parent_id !== null) {
            $category = $category->parent;

            if ($category === null) {
                break;
            }

            $chain[] = $category;
        }

        return array_reverse($chain);
    }
}
