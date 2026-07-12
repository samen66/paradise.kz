<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Support\Phone;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guest order tracking: the order number AND the phone it was placed with
 * must both match (anti-enumeration — a number alone reveals nothing).
 * Route-throttled against brute force.
 */
class OrderTrackingController extends Controller
{
    public function __invoke(Request $request): OrderResource
    {
        $validated = $request->validate([
            'number' => ['required', 'string', 'max:32'],
            'phone' => ['required', 'string', 'max:32'],
        ], [
            'number.required' => 'Укажите номер заказа.',
            'phone.required' => 'Укажите номер телефона.',
        ]);

        $order = Order::query()
            ->where('number', $validated['number'])
            ->with(['items', 'store', 'user'])
            ->first();

        $phoneMatches = $order !== null
            && $order->user !== null
            && Phone::normalize((string) $order->user->phone) === Phone::normalize($validated['phone']);

        if (! $phoneMatches) {
            abort(Response::HTTP_NOT_FOUND, 'Заказ не найден.');
        }

        return new OrderResource($order);
    }
}
