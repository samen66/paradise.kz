<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\ProductVisibilityOverride;
use App\Models\User;
use Illuminate\Contracts\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Eloquent\Builder;

/**
 * Decides which products a B2B client may see.
 *
 * A product P is visible to user U iff ALL of:
 *   - P.is_active is true (hard global switch; inactive = hidden from everyone), AND
 *   - there is NO override (U,P) with mode='hide', AND
 *   - ( there IS an override (U,P) with mode='allow'
 *       OR P belongs to zero catalog groups
 *       OR P shares at least one catalog group with U ).
 *
 * Meaning: products in no group are open to all approved clients; products
 * assigned to group(s) are restricted to members of those group(s); a per-client
 * 'allow' override force-grants a restricted product; a 'hide' override
 * force-removes any product.
 */
class VisibilityService
{
    /**
     * A (non-executed) Product query scoped to products visible to $user.
     *
     * @return Builder<Product>
     */
    public function visibleProductQuery(User $user): Builder
    {
        return Product::query()
            // Hard global switch: inactive products are hidden from everyone.
            ->where('products.is_active', true)
            // A 'hide' override force-removes the product for this client.
            ->whereNotExists(function (QueryBuilder $query) use ($user): void {
                $query->selectRaw('1')
                    ->from('product_visibility_overrides')
                    ->whereColumn('product_visibility_overrides.product_id', 'products.id')
                    ->where('product_visibility_overrides.user_id', $user->getKey())
                    ->where('product_visibility_overrides.mode', ProductVisibilityOverride::MODE_HIDE);
            })
            ->where(function (Builder $outer) use ($user): void {
                $outer
                    // An 'allow' override force-grants an otherwise-restricted product.
                    ->whereExists(function (QueryBuilder $query) use ($user): void {
                        $query->selectRaw('1')
                            ->from('product_visibility_overrides')
                            ->whereColumn('product_visibility_overrides.product_id', 'products.id')
                            ->where('product_visibility_overrides.user_id', $user->getKey())
                            ->where('product_visibility_overrides.mode', ProductVisibilityOverride::MODE_ALLOW);
                    })
                    // Product in no group is open to all approved clients.
                    ->orWhereNotExists(function (QueryBuilder $query): void {
                        $query->selectRaw('1')
                            ->from('catalog_group_product')
                            ->whereColumn('catalog_group_product.product_id', 'products.id');
                    })
                    // Product shares at least one catalog group with the client.
                    ->orWhereExists(function (QueryBuilder $query) use ($user): void {
                        $query->selectRaw('1')
                            ->from('catalog_group_product')
                            ->join(
                                'catalog_group_user',
                                'catalog_group_user.catalog_group_id',
                                '=',
                                'catalog_group_product.catalog_group_id',
                            )
                            ->whereColumn('catalog_group_product.product_id', 'products.id')
                            ->where('catalog_group_user.user_id', $user->getKey());
                    });
            });
    }

    public function canSee(User $user, Product $product): bool
    {
        return $this->visibleProductQuery($user)
            ->whereKey($product->getKey())
            ->exists();
    }

    /**
     * A (non-executed) Product query scoped to products visible to anonymous
     * (guest/B2C) storefront visitors: active AND in no catalog group.
     * Catalog groups exist to restrict an assortment to specific B2B clients,
     * so a grouped product is never publicly browsable — there is no "allow"
     * override path for guests, since overrides are per-client.
     *
     * @return Builder<Product>
     */
    public function publicProductQuery(): Builder
    {
        return Product::query()
            ->where('products.is_active', true)
            ->whereNotExists(function (QueryBuilder $query): void {
                $query->selectRaw('1')
                    ->from('catalog_group_product')
                    ->whereColumn('catalog_group_product.product_id', 'products.id');
            });
    }

    public function canSeePublicly(Product $product): bool
    {
        return $this->publicProductQuery()
            ->whereKey($product->getKey())
            ->exists();
    }
}
