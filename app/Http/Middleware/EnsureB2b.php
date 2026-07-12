<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts B2B endpoints (wholesale catalog/pricing, B2B orders) to b2b-type
 * accounts. Without this gate a retail customer's Sanctum token could read
 * B2B prices: retail users are created auto-approved, so `EnsureApproved`
 * alone does not stop them. Auth is assumed (run after `auth:sanctum`).
 */
class EnsureB2b
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->type !== User::TYPE_B2B) {
            return new JsonResponse(
                ['message' => 'Раздел доступен только оптовым клиентам.'],
                Response::HTTP_FORBIDDEN,
            );
        }

        return $next($request);
    }
}
