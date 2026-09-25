<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\WriteOff;
use App\Models\WriteOffItem;
use Illuminate\Validation\ValidationException;

/**
 * Добавление строк в черновик приёмки или списания: количество по умолчанию
 * 1, себестоимость строки приёмки по умолчанию — {@see SuggestedUnitCost};
 * товар, который уже есть в документе, увеличивает количество своей строки
 * (себестоимость строки не меняется) вместо второй строки.
 *
 * Вызывать внутри `whileDraft` (`RefusesPostedDocuments`): документ уже
 * заблокирован, и `ValidationException` откатывает всю транзакцию.
 */
class DocumentLines
{
    /** Наибольшее количество в строке, в тысячных (`9999999.999`). */
    private const MAX_MILLI_QUANTITY = 9_999_999_999;

    public function __construct(private readonly SuggestedUnitCost $costs) {}

    /**
     * @return array{item: GoodsReceiptItem|WriteOffItem, created: bool}
     */
    public function add(GoodsReceipt|WriteOff $document, int $productId, ?string $quantity = null, ?int $unitCost = null): array
    {
        $quantity ??= '1';

        /** @var GoodsReceiptItem|WriteOffItem|null $existing */
        $existing = $document->items()->where('product_id', $productId)->orderBy('id')->first();

        if ($existing !== null) {
            $existing->quantity = $this->sum((string) $existing->quantity, $quantity);
            $existing->save();

            return ['item' => $existing, 'created' => false];
        }

        $attributes = ['product_id' => $productId, 'quantity' => $this->sum('0', $quantity)];

        if ($document instanceof GoodsReceipt) {
            $attributes['unit_cost'] = $unitCost ?? $this->costs->for($productId, $document->store_id);
        }

        return ['item' => $document->items()->create($attributes), 'created' => true];
    }

    /**
     * Повторы внутри $lines складываются до записи; себестоимость новых строк
     * приёмки считается одним запросом на всю пачку.
     *
     * @param  list<array{product_id: int|string, quantity?: string|int|float|null}>  $lines
     */
    public function addMany(GoodsReceipt|WriteOff $document, array $lines): void
    {
        $quantities = [];

        foreach ($lines as $line) {
            $productId = (int) $line['product_id'];
            $quantity = isset($line['quantity']) ? (string) $line['quantity'] : '1';
            $quantities[$productId] = isset($quantities[$productId]) ? $this->sum($quantities[$productId], $quantity) : $quantity;
        }

        $costs = $document instanceof GoodsReceipt
            ? $this->costs->forMany(array_keys($quantities), $document->store_id)
            : [];

        foreach ($quantities as $productId => $quantity) {
            $this->add($document, $productId, $quantity, $costs[$productId] ?? null);
        }
    }

    /**
     * Сумма двух количеств в тысячных — без накопления ошибки float.
     */
    private function sum(string $left, string $right): string
    {
        $milli = (int) round((float) $left * 1000) + (int) round((float) $right * 1000);

        if ($milli > self::MAX_MILLI_QUANTITY) {
            throw ValidationException::withMessages([
                'quantity' => 'Количество в строке не может быть больше 9 999 999,999.',
            ]);
        }

        return number_format($milli / 1000, 3, '.', '');
    }
}
