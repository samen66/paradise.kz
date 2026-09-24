<?php

declare(strict_types=1);

namespace App\Services\Inventory;

use App\Models\GoodsReceipt;
use App\Models\Order;
use App\Models\StockMovement;
use App\Models\WriteOff;

/**
 * Движение складского журнала в виде для API: журнал движений и
 * «последние движения» на обзоре склада отдают одно и то же.
 */
final class StockMovementPresenter
{
    /**
     * Отношения, которые нужно загрузить заранее, чтобы present() не делал N+1.
     *
     * @var list<string>
     */
    public const RELATIONS = ['store:id,name', 'product:id,name,code', 'user:id,name', 'documentable'];

    /**
     * @return array<string, mixed>
     */
    public function present(StockMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'created_at' => $movement->created_at,
            'type' => $movement->type,
            'qty_delta' => (float) $movement->qty_delta,
            'unit_cost' => $movement->unit_cost === null ? null : (int) $movement->unit_cost,
            'balance_after' => $movement->balance_after === null ? null : (float) $movement->balance_after,
            'note' => $movement->note,
            'store' => $movement->store?->only(['id', 'name']),
            'product' => $movement->product === null ? null : [
                'id' => $movement->product->id,
                'name' => $movement->product->getTranslations('name'),
                'code' => $movement->product->code,
            ],
            'user' => $movement->user?->only(['id', 'name']),
            'document' => $this->document($movement),
        ];
    }

    /**
     * @return array{type: string, id: int, label: string}|null
     */
    private function document(StockMovement $movement): ?array
    {
        $document = $movement->documentable;

        return match (true) {
            $document instanceof GoodsReceipt => ['type' => 'receipt', 'id' => $document->id, 'label' => 'Приёмка '.($document->number ?: '№'.$document->id)],
            $document instanceof WriteOff => ['type' => 'write_off', 'id' => $document->id, 'label' => $document->label()],
            $document instanceof Order => ['type' => 'order', 'id' => $document->id, 'label' => 'Заказ '.$document->number],
            default => null,
        };
    }
}
