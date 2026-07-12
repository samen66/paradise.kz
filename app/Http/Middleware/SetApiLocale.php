<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the response language for API requests: explicit `?locale=` wins,
 * then the Accept-Language header, whitelisted to config('app.locales').
 * Unknown values silently fall back to the default (ru) — a wrong locale must
 * never break an API call.
 */
class SetApiLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $supported = config()->array('app.locales');

        $requested = $request->query('locale') ?? $request->getPreferredLanguage($supported);

        if (is_string($requested) && in_array($requested, $supported, true)) {
            app()->setLocale($requested);
        }

        return $next($request);
    }
}
