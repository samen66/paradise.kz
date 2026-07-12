<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The storefront customer's own profile. Works for any authenticated account
 * (everything is self-scoped), but is primarily the retail counterpart of the
 * B2B /auth endpoints.
 */
class ProfileController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        return new JsonResponse(['user' => new UserResource($request->user())]);
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->validated());

        return new JsonResponse(['user' => new UserResource($user->fresh())]);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
