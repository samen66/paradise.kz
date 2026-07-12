<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

/**
 * The authenticated customer's own order history (retail or B2B — everything
 * is ownership-scoped). Foreign orders 404 rather than 403 so their existence
 * never leaks.
 */
class OrderController extends Controller
{
    private const PER_PAGE = 10;

    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $request->user()
            ->orders()
            ->with(['items', 'store'])
            ->latest('id')
            ->paginate(self::PER_PAGE);

        return OrderResource::collection($orders);
    }

    public function show(Request $request, Order $order): OrderResource
    {
        if ($order->user_id !== $request->user()->id) {
            abort(Response::HTTP_NOT_FOUND);
        }

        return new OrderResource($order->load(['items', 'store', 'address']));
    }
}
