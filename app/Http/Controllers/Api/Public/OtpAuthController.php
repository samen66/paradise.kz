<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\RequestOtpRequest;
use App\Http\Requests\Public\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\OtpService;
use Illuminate\Http\JsonResponse;

/**
 * Storefront (B2C) login: phone + SMS code. Successful verification issues a
 * Sanctum bearer token for the canonical retail account (created on first
 * login) — see OtpService for rate limits and guest-order claiming.
 */
class OtpAuthController extends Controller
{
    public function __construct(
        private readonly OtpService $otp,
    ) {}

    public function request(RequestOtpRequest $request): JsonResponse
    {
        $this->otp->request($request->validated()['phone']);

        return new JsonResponse(['message' => 'Код отправлен по SMS.']);
    }

    public function verify(VerifyOtpRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $this->otp->verify($validated['phone'], $validated['code']);

        return new JsonResponse([
            'token' => $user->createToken('storefront')->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }
}
