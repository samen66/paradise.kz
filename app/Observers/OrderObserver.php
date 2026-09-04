<?php

declare(strict_types=1);

namespace App\Observers;

use App\Jobs\SendWhatsAppNotificationJob;
use App\Models\CatalogSetting;
use App\Models\Order;

/**
 * Keeps the two humans in the loop over WhatsApp: the customer when their
 * order's status moves, and the shop when a new order lands.
 *
 * The shop-side notification is what makes "orders get worked" true rather
 * than aspirational — without it nothing tells a manager an order exists and
 * it sits in `pending` until someone happens to refresh the admin panel.
 */
class OrderObserver
{
    public function created(Order $order): void
    {
        $notifyPhone = CatalogSetting::current()->contact_phone;

        if (blank($notifyPhone)) {
            return;
        }

        $total = number_format($order->total / 100, 0, ',', ' ');

        SendWhatsAppNotificationJob::dispatch(
            $order,
            "Новый заказ #{$order->number} на {$total} ₸. Откройте админ-панель, чтобы обработать.",
            $notifyPhone,
        );
    }

    public function updated(Order $order): void
    {
        if (! $order->wasChanged('status')) {
            return;
        }

        $message = match ($order->status) {
            Order::STATUS_CONFIRMED => "Ваш заказ #{$order->number} принят и подтверждён.",
            Order::STATUS_IN_DELIVERY => "Ваш заказ #{$order->number} передан в доставку.",
            Order::STATUS_COMPLETED => "Ваш заказ #{$order->number} готов к выдаче.",
            Order::STATUS_CANCELLED => "Ваш заказ #{$order->number} отменён. Если это ошибка — свяжитесь с нами.",
            default => null,
        };

        if ($message !== null) {
            SendWhatsAppNotificationJob::dispatch($order, $message);
        }
    }
}
