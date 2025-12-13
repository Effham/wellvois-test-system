<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireTenantContext
{
    /**
     * Handle an incoming request.
     *
     * Ensures that the request is made within a tenant context (not on central domain).
     * If accessed from central domain, returns a 403 error.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if we're in a tenant context
        if (! tenant()) {
            abort(403, 'Access denied: This resource is only available within a clinic context.');
        }

        return $next($request);
    }
}
