<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\UpdateSettingsRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Register a new B2B client. The account starts unapproved (pending) and
     * receives no token — an admin must approve it first.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'] ?? $data['company_name'],
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'],
            'password' => $data['password'],
            'company_name' => $data['company_name'],
            'company_bin' => $data['company_bin'],
            'is_approved' => false,
            'preferred_store_id' => $data['preferred_store_id'] ?? null,
        ]);

        // Role is normally provisioned by RolesAndPermissionsSeeder; ensure it
        // exists so registration never fails on a fresh environment.
        Role::findOrCreate('b2b_customer', 'web');
        $user->assignRole('b2b_customer');

        $token = $user->createToken('api')->plainTextToken;

        return new JsonResponse([
            'token' => $token,
            'user' => new UserResource($user),
        ], Response::HTTP_CREATED);
    }

    /**
     * Validate credentials and issue a Sanctum token. Login is allowed for
     * unapproved clients so the SPA can render a "pending approval" screen.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        // B2B clients sign in with a phone, admin-panel staff with an email —
        // whichever was sent is the field the error belongs on, so the form
        // highlights the input the person actually filled.
        $field = isset($credentials['email']) ? 'email' : 'phone';

        $user = User::where($field, $credentials[$field])->first();

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
