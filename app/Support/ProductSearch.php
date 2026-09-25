<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Product;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Поиск товара без учёта регистра на любой СУБД.
 *
 * `name->ru LIKE` в MySQL сравнивает результат json_extract в utf8mb4_bin, и
 * «диван» не находит «Диван»; SQLite (тесты) не складывает регистр кириллицы
 * ни в LIKE, ни в lower(). Поэтому регистр снимается в PHP: при сохранении
 * товара в `products.search_text` пишутся названия (ru, kk), код и артикул в
 * нижнем регистре, и искомая строка приводится так же.
 */
final class ProductSearch
{
    /**
     * Текст колонки `search_text` для товара.
     */
    public static function haystack(Product $product): string
    {
        $parts = [
            $product->getTranslation('name', 'ru', false),
            $product->getTranslation('name', 'kk', false),
            $product->code,
            $product->article,
        ];

        return self::normalize(implode(' ', array_filter($parts, fn (?string $part): bool => $part !== null && $part !== '')));
    }

    public static function normalize(string $text): string
    {
        return mb_strtolower(trim($text));
    }

    /**
     * Оставляет в запросе к `products` товары, в тексте которых есть $term.
     * `%` и `_` ищутся как обычные символы; экранирующий символ — `!`,
     * потому что `ESCAPE '\'` в MySQL и SQLite записывается по-разному.
     */
    public static function apply(Builder $query, string $term, string $column = 'products.search_text'): void
    {
        $needle = self::normalize($term);

        if ($needle === '') {
            return;
        }

        $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $needle);

        $query->whereRaw("{$column} LIKE ? ESCAPE '!'", ["%{$escaped}%"]);
    }

    /**
     * Заполняет `search_text` у товаров, где он пуст (сохранённых до появления
     * колонки или вставленных мимо событий модели). Возвращает их количество.
     */
    public static function backfill(): int
    {
        $filled = 0;

        Product::query()->whereNull('search_text')->chunkById(500, function (Collection $products) use (&$filled): void {
            foreach ($products as $product) {
                DB::table('products')->where('id', $product->id)->update(['search_text' => self::haystack($product)]);
                $filled++;
            }
        });

        return $filled;
    }
}
