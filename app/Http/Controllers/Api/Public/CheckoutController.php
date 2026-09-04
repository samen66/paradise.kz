<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\GuestCheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\User;
use App\Services\Orders\OrderPlacementService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Storefront checkout. Anonymous by default (placeGuest creates a throwaway
 * user), but when a logged-in retail customer sends their bearer token the
 * order lands on their real account instead — with saved addresses honoured.
 */
class CheckoutController extends Controller
{
    public function __construct(
        private readonly OrderPlacementService $placement,
    ) {}

    public function store(GuestCheckoutRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // The route is public, so resolve the token manually if one was sent.
        $user = $request->user('sanctum');

        if ($user !== null && $user->type === User::TYPE_RETAIL && ! $user->is_guest) {
            $order = $this->placement->placeRetail(
                $user,
                $validated['items'],
                $validated['store_id'],
                $validated['payment_method'],
                $validated['comment'] ?? null,
                $validated['delivery'] ?? null,
                $validated['email'] ?? null,
            );
        } else {
            $order = $this->placement->placeGuest(
                $validated['name'],
                $validated['phone'],
                $validated['email'] ?? null,
                $validated['items'],
                $validated['store_id'],
                $validated['payment_method'],
                $validated['comment'] ?? null,
                $validated['delivery'] ?? null,
            );
        }

        // No push to an external system: orders are worked through their
        // statuses in the admin panel. (This used to dispatch PushOrderJob,
        // which — because a guest never has an ERP counterparty — flipped every
        // storefront order to `failed` seconds after checkout.)
        $resource = new OrderResource($order);
        if ($order->payment_method === 'kaspi') {
            $resource->additional([
                'payment_url' => config('services.kaspi.payment_base_url').'?order='.$order->number,
            ]);
        }

        return $resource->response()->setStatusCode(Response::HTTP_CREATED);
    }
}
