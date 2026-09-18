<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\PhoneCodeRequest;
use App\Http\Requests\Auth\PhoneLoginRequest;
use App\Http\Requests\Auth\PhoneRegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Auth\B2bPhoneAuthService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * B2B portal sign-up and sign-in by phone + SMS code. See B2bPhoneAuthService.
 */
class PhoneAuthController extends Controller
{
    public function __construct(
        private readonly B2bPhoneAuthService $auth,
    ) {}

    public function request(PhoneCodeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $this->auth->requestCode($validated['phone'], $validated['intent']);

        return new JsonResponse(['message' => 'Код отправлен по SMS.']);
    }

    public function register(PhoneRegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $this->auth->register(
            $validated['phone'],
            $validated['code'],
            $validated['name'],
            $validated['company_name'] ?? null,
        );

        return new JsonResponse($this->session($user), Response::HTTP_CREATED);
    }

    public function login(PhoneLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return new JsonResponse($this->session($this->auth->login($validated['phone'], $validated['code'])));
    }

    /**
     * @return array{token: string, user: UserResource}
     */
    private function session(User $user): array
    {
        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => new UserResource($user),
        ];
    }
}
