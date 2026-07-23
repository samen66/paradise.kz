<?php

declare(strict_types=1);

namespace App\Services\WhatsApp;

use App\Models\CatalogSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $apiUrl;
    private string $apiKey;
    private string $instanceId;

    public function __construct()
    {
        $settings = CatalogSetting::current();
        
        $this->apiUrl = $settings->whatsapp_api_url ?? config('services.whatsapp.api_url', '');
        $this->apiKey = $settings->whatsapp_api_key ?? config('services.whatsapp.api_key', '');
        $this->instanceId = $settings->whatsapp_instance_id ?? config('services.whatsapp.instance_id', '');
    }

    public function sendMessage(string $phone, string $message): bool
    {
        if (empty($this->apiUrl) || empty($this->apiKey) || empty($this->instanceId)) {
            Log::warning('WhatsApp service is not configured. Message not sent.', ['phone' => $phone]);
            return false;
        }

        // Remove any non-numeric characters from the phone number
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);

        try {
            // Using a generic provider structure (like GreenAPI/WABA360)
            $response = Http::post(rtrim($this->apiUrl, '/') . "/waInstance{$this->instanceId}/sendMessage/{$this->apiKey}", [
                'chatId' => $cleanPhone . '@c.us',
                'message' => $message,
            ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('WhatsApp API request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'phone' => $phone,
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('WhatsApp API exception', [
                'error' => $e->getMessage(),
                'phone' => $phone,
            ]);

            return false;
        }
    }
}
