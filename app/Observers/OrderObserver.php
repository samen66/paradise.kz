<?php

declare(strict_types=1);

namespace App\Observers;

use App\Jobs\SendWhatsAppNotificationJob;
use App\Models\Order;

class OrderObserver
{
    public function updated(Order $order): void
    {
        if ($order->wasChanged('status')) {
            $message = match ($order->status) {
                'confirmed' => "Ваш заказ #{$order->number} принят и подтверждён.",
                'in_delivery' => "Ваш заказ #{$order->number} передан в доставку.",
                'completed' => "Ваш заказ #{$order->number} готов к выдаче.",
                default => null,
            };

            if ($message) {
                SendWhatsAppNotificationJob::dispatch($order, $message);
            }
        }
    }
}
