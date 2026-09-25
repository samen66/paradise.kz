<?php

declare(strict_types=1);

namespace App\Support;

use App\Http\Controllers\Api\Admin\ProductMediaController;
use App\Models\Product;

/**
 * Миниатюра первого фото товара — для «Остатков», «Подбора» и строк
 * документов. Товар должен прийти с загруженным `media`, иначе на каждый
 * товар уйдёт отдельный запрос.
 */
final class ProductThumb
{
    public static function url(Product $product): ?string
    {
        $photo = $product->getFirstMedia(Product::IMAGE_COLLECTION);

        return $photo === null ? null : ProductMediaController::present($photo)['thumb_url'];
    }

    /**
     * Проставляет товарам `thumb_url` и убирает загруженный `media` из ответа.
     *
     * @param  iterable<Product|null>  $products
     */
    public static function attach(iterable $products): void
    {
        foreach ($products as $product) {
            if ($product === null) {
                continue;
            }

            $product->setAttribute('thumb_url', self::url($product));
            $product->unsetRelation('media');
        }
    }
}
