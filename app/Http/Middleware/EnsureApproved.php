<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks not-yet-approved B2B clients from approval-gated endpoints
 * (catalog, orders). Auth is assumed (run after `auth:sanctum`).
 */
class EnsureApproved
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->is_approved) {
            return new JsonResponse(
                ['message' => 'Ваш аккаунт ещё не одобрен.'],
                Response::HTTP_FORBIDDEN,
            );
        }

        return $next($request);
    }
}
