<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UpdateSettingsRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Validate credentials and issue a Sanctum token. Login is allowed for
     * unapproved clients: they browse the catalog without prices.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        // B2B clients sign in with a phone, admin-panel staff with an email —
        // whichever was sent is the field the error belongs on, so the form
        // highlights the input the person actually filled.
        $field = isset($credentials['email']) ? 'email' : 'phone';

        // Phones were stored as typed before SMS login normalized them; match
        // both spellings so either form of the same number signs in.
        $user = $field === 'email'
            ? User::where('email', $credentials['email'])->first()
            : User::whereIn('phone', array_unique([$credentials['phone'], Phone::normalize($credentials['phone'])]))->first();

        if ($user === null || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                $field => ['Неверный логин или пароль.'],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return new JsonResponse([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Return the authenticated user and their approval state.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return new JsonResponse([
            'user' => new UserResource($user),
            'is_approved' => (bool) $user->is_approved,
        ]);
    }

    /**
     * Update the authenticated client's own settings (currently: preferred
     * warehouse).
     */
    public function updateSettings(UpdateSettingsRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->validated());

        return (new UserResource($user->fresh()))->response();
    }

    /**
     * Revoke the token used for the current request.
     */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
