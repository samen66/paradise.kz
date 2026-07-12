<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Addresses\AddressRequest;
use App\Http\Resources\AddressResource;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

/**
 * Self-service CRUD for the authenticated B2B client's own saved delivery
 * addresses. Guests have no account and so no saved addresses — they submit
 * address fields inline at checkout instead.
 */
class AddressController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $addresses = $request->user()
            ->addresses()
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return AddressResource::collection($addresses);
    }

    public function store(AddressRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        if (! empty($data['is_default'])) {
            $user->addresses()->update(['is_default' => false]);
        }

        $address = $user->addresses()->create($data);

        return (new AddressResource($address))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(AddressRequest $request, Address $address): AddressResource
    {
        $this->authorizeOwnership($request, $address);
        $data = $request->validated();

        if (! empty($data['is_default'])) {
            $request->user()->addresses()->whereKeyNot($address->id)->update(['is_default' => false]);
        }

        $address->update($data);

        return new AddressResource($address);
    }

    public function destroy(Request $request, Address $address): Response
    {
        $this->authorizeOwnership($request, $address);
        $address->delete();

        return response()->noContent();
    }

    /**
     * 404 (not 403) for another client's address, so its existence never leaks.
     */
    private function authorizeOwnership(Request $request, Address $address): void
    {
        if ($address->user_id !== $request->user()->id) {
            abort(Response::HTTP_NOT_FOUND);
        }
    }
}
