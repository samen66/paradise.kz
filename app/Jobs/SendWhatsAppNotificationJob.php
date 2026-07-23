<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Order;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWhatsAppNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public string $message
    ) {
    }

    public function handle(WhatsAppService $service): void
    {
        $phone = $this->order->contacts['phone'] ?? null;

        // If the order has no direct phone contact, try to use the user's phone if B2C
        if (! $phone && $this->order->user) {
            $phone = $this->order->user->phone;
        }

        if (! $phone) {
            return;
        }

        $service->sendMessage($phone, $this->message);
    }
}
