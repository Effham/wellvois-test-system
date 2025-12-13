<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CanAccessTenant
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Log immediately at the very start, before any other code
        \Illuminate\Support\Facades\Log::info('CanAccessTenant middleware START', [
            'path' => $request->path(),
            'method' => $request->method(),
            'url' => $request->fullUrl(),
        ]);
        
        $routeName = $request->route()?->getName();
        $hasTenantContext = tenant() !== null;
        $isCentralDomain = in_array($request->getHost(), config('tenancy.central_domains', []));
        
        \Illuminate\Support\Facades\Log::info('CanAccessTenant middleware executing', [
            'route_name' => $routeName,
            'path' => $request->path(),
            'has_tenant_context' => $hasTenantContext,
            'is_central_domain' => $isCentralDomain,
            'user_id' => Auth::id(),
        ]);

        $centralUser = null;
        try {
            tenancy()->central(function () use (&$centralUser) {
                $centralUser = User::where('email', Auth::user()->email)->first();
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('CanAccessTenant: Error accessing central user', [
                'error' => $e->getMessage(),
                'route_name' => $routeName,
            ]);
        }

        if (! tenant()) {
            \Illuminate\Support\Facades\Log::info('CanAccessTenant: No tenant context, allowing request', [
                'route_name' => $routeName,
            ]);
            return $next($request);
        }

        if (! $centralUser || ! $centralUser->tenants()->where('tenant_id', tenant()->id)->exists()) {
            \Illuminate\Support\Facades\Log::warning('CanAccessTenant: Access denied', [
                'route_name' => $routeName,
                'tenant_id' => tenant()->id,
                'has_central_user' => $centralUser !== null,
            ]);
            abort(403, 'Access denied: You are not assigned to this tenant.');
        }

        \Illuminate\Support\Facades\Log::info('CanAccessTenant: Access granted', [
            'route_name' => $routeName,
            'tenant_id' => tenant()->id,
        ]);

        return $next($request);
    }
}
