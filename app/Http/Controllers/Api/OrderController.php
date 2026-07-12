<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Orders\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Jobs\Erp\PushOrderJob;
use App\Models\Order;
use App\Services\Orders\OrderPlacementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

class OrderController extends Controller
{
    private const PER_PAGE = 20;

    public function __construct(
        private readonly OrderPlacementService $placement,
    ) {}

    /**
     * The authenticated client's order history, newest first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = $request->user()
            ->orders()
            ->with(['items', 'store'])
            ->latest()
            ->paginate(self::PER_PAGE)
            ->appends($request->query());

        return OrderResource::collection($orders);
    }

    /**
     * Place an order. Lines are validated against visibility + stock and have
     * their per-client price snapshotted, then the order is queued for push to
     * MoySklad. Checkout never blocks on MoySklad.
     */
    public function store(StoreOrderRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $order = $this->placement->place(
            $request->user(),
            $validated['items'],
            $validated['store_id'],
            $validated['comment'] ?? null,
            $validated['delivery'] ?? null,
        );

        PushOrderJob::dispatch($order);

        return (new OrderResource($order))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Order detail. Returns 404 (not 403) for another client's order so its
     * existence never leaks.
     */
    public function show(Request $request, Order $order): OrderResource
    {
        if ($order->user_id !== $request->user()->id) {
            abort(Response::HTTP_NOT_FOUND);
        }

        return new OrderResource($order->load(['items', 'store']));
    }
}
