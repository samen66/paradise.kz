<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class KaspiWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = config('services.kaspi.webhook_secret');

        if ($secret) {
            $signature = $request->header('X-Kaspi-Signature');
            $expected = hash_hmac('sha256', (string) $request->getContent(), $secret);

            if (! $signature || ! hash_equals($expected, $signature)) {
                return response()->json(['error' => 'Invalid signature'], Response::HTTP_FORBIDDEN);
            }
        }

        $validated = $request->validate([
            'order_id' => ['required', 'integer'],
            'status' => ['required', 'string', 'in:paid,cancelled,failed'],
        ]);

        $order = Order::find($validated['order_id']);

        if (! $order) {
            return response()->json(['error' => 'Order not found'], Response::HTTP_NOT_FOUND);
        }

        $order->update(['payment_status' => $validated['status']]);

        return response()->json(['success' => true]);
    }
}
