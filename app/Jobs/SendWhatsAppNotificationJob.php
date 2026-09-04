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

    /**
     * @param  string|null  $toPhone  Explicit recipient. Null means the customer
     *                                who placed the order — the usual case; the
     *                                shop passes its own number for new-order alerts.
     */
    public function __construct(
        public Order $order,
        public string $message,
        public ?string $toPhone = null,
    ) {}

    public function handle(WhatsAppService $service): void
    {
        $phone = $this->toPhone ?? $this->customerPhone();

        if (blank($phone)) {
            return;
        }

        $service->sendMessage($phone, $this->message);
    }

    private function customerPhone(): ?string
    {
        $phone = $this->order->contacts['phone'] ?? null;

        // Guests carry their phone on the throwaway user row created at checkout.
        if (blank($phone) && $this->order->user !== null) {
            $phone = $this->order->user->phone;
        }

        return $phone;
    }
}
