<?php

declare(strict_types=1);

namespace App\Services\MoySklad;

use App\Contracts\Erp\OrderTarget;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Services\Erp\Data\PushedOrder;

/**
 * MoySklad implementation of the {@see OrderTarget} contract: turns our neutral
 * order/counterparty models into MoySklad customerorder/counterparty payloads.
 *
 * @see docs/moysklad-integration-notes.md (section 8)
 */
class MoySkladOrderTarget implements OrderTarget
{
    public function __construct(
        private readonly MoySkladService $service,
    ) {}

    public function createCounterparty(User $user): string
    {
        $counterparty = $this->service->createCounterparty([
            'name' => (string) $user->company_name,
            'companyType' => 'legalKZ',
            'inn' => (string) $user->company_bin,
            'email' => (string) $user->email,
            'phone' => (string) $user->phone,
        ]);

        return (string) ($counterparty['id'] ?? '');
    }

    public function pushOrder(Order $order, string $counterpartyExternalId): PushedOrder
    {
        $response = $this->service->createCustomerOrder(
            $this->buildPayload($order, $counterpartyExternalId),
        );

        return new PushedOrder(
            externalId: (string) ($response['id'] ?? ''),
            number: isset($response['name']) ? (string) $response['name'] : null,
        );
    }

    public function orderState(string $externalOrderId): ?string
    {
        return $this->service->customerOrderState($externalOrderId);
    }

    /**
     * Build the customerorder body. Line prices are ALREADY in kopecks (the
     * per-client snapshot in order_items.price), so they are forwarded as-is.
     *
     * @return array<string, mixed>
     */
    private function buildPayload(Order $order, string $counterpartyExternalId): array
    {
        $base = rtrim((string) config('moysklad.base_url'), '/');
        $vat = (int) config('moysklad.vat_percent');

        return [
            'organization' => MoySkladService::meta(
                (string) config('moysklad.organization_href'),
                'organization',
            ),
            'agent' => MoySkladService::meta(
                $base.'/entity/counterparty/'.$counterpartyExternalId,
                'counterparty',
            ),
            'description' => "Заказ #{$order->id} (paradise.kz)",
            'positions' => $order->items->map(
                fn (OrderItem $item): array => [
                    'assortment' => MoySkladService::meta(
                        $base.'/entity/product/'.$item->external_product_id,
                        'product',
                    ),
                    'quantity' => (float) $item->quantity,
                    // Snapshot is ALREADY in kopecks — forward as-is.
                    'price' => $item->price,
                    'vat' => $vat,
                ],
            )->all(),
            'store' => MoySkladService::meta(
                $base.'/entity/store/'.$order->store->external_id,
                'store',
            ),
        ];
    }
}
