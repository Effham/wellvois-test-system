<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CentralGuestAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Only apply this middleware on central domains
        if (! in_array($request->getHost(), config('tenancy.central_domains', []))) {
            return $next($request);
        }

        // Allow access to change-plan routes for both authenticated and guest users
        // This supports both registration flow (guests) and billing setup flow (authenticated)
        if ($request->routeIs('change-plan.*')) {
            return $next($request);
        }

        // Check if user is authenticated
        if (Auth::check()) {
            $user = Auth::user();

            // Don't auto-redirect practitioner/patient users
            // Allow them to access any central route they qualify for
            // Access control is handled by individual route controllers

            // Admin/Staff users: Check tenant relationships
            $tenants = $user->tenants()->with('domains')->get();

            if ($tenants->isEmpty()) {
                // Central-only admin user - can access central dashboard
                // Don't redirect, let them access the route they requested
                return $next($request);
            }

            // User has tenant access - but don't auto-redirect
            // Let them access central routes if they have practitioner/patient records
            // Otherwise, redirect to tenant if accessing root routes
            if ($tenants->count() === 1 && $request->is('/')) {
                // Only redirect root path to tenant
                $tenant = $tenants->first();

                // 🔒 Check if tenant requires billing setup before allowing access
                if ($tenant->requiresBilling()) {
                    return redirect()->route('billing.setup')
                        ->with('warning', 'Please complete your subscription setup to access your workspace.');
                }

                return app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class)
                    ->redirectToTenant($tenant, $user);
            }

            // Multiple tenants or accessing specific routes - allow access
            return $next($request);
        }

        return $next($request);
    }
}
