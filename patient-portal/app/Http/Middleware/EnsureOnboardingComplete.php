<?php

namespace App\Http\Middleware;

use App\Models\OrganizationSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboardingComplete
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Skip middleware for onboarding routes to avoid redirect loops
        if ($request->routeIs('onboarding.*')) {
            return $next($request);
        }

        // Skip middleware for API routes
        if ($request->is('api/*')) {
            return $next($request);
        }

        // Skip onboarding check on central domains (onboarding is tenant-specific only)
        $isCentralDomain = in_array($request->getHost(), config('tenancy.central_domains', []));
        if ($isCentralDomain) {
            return $next($request);
        }

        // Check if onboarding is complete (only in tenant context)
        $isOnboardingComplete = OrganizationSetting::getValue('isOnboardingComplete', 'false');

        // If onboarding is not complete and accessing dashboard, redirect to onboarding
        if ($isOnboardingComplete !== 'true' && $request->routeIs('dashboard')) {
            return redirect()->route('onboarding.index');
        }

        return $next($request);
    }
}
