<?php

declare(strict_types=1);

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Translations;

/**
 * Makes an owner's characteristics exactly the given set: one row per
 * attribute, its value replaced (a cleared kk is dropped, not kept), rows of
 * attributes no longer listed deleted. Shared by products and variants —
 * both keep `attribute_id` + translatable `value` rows.
 *
 * The relation is re-created for every query: a HasMany instance keeps the
 * where() clauses of firstOrNew(), so reusing one would narrow every next
 * lookup to the previous attribute.
 *
 * Not `final`: ProductAttributeValuesTest mocks this class with
 * `$this->mock()`, which Mockery cannot do for a final class (it needs to
 * generate a subclass double, and PHP forbids extending a final one).
 */
class AttributeValueSync
{
    /**
     * @param  list<array{attribute_id: int|string, value: array<string, string|null>}>  $rows
     */
    public function sync(Product|ProductVariant $owner, array $rows): void
    {
        $kept = [];

        foreach ($rows as $row) {
            $attributeId = (int) $row['attribute_id'];

            $value = $owner->attributeValues()->firstOrNew(['attribute_id' => $attributeId]);
            $value->replaceTranslations('value', Translations::filled($row['value']));
            $value->save();

            $kept[] = $attributeId;
        }

        $owner->attributeValues()->whereNotIn('attribute_id', $kept)->delete();
    }
}
