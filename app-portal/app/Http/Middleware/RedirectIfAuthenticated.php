<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        $guards = empty($guards) ? [null] : $guards;

        foreach ($guards as $guard) {
            if (Auth::guard($guard)->check()) {
                // User is authenticated, redirect them away from guest pages

                // Check if we're on a central domain
                if (in_array($request->getHost(), config('tenancy.central_domains', []))) {
                    // On central domain - redirect to appropriate dashboard
                    $user = Auth::user();

                    // Check if user is a practitioner or patient
                    $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
                    $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();

                    if ($isPractitioner || $isPatient) {
                        return redirect()->route('dashboard');
                    }

                    // Check tenant relationships
                    $tenants = $user->tenants()->with('domains')->get();

                    if ($tenants->isEmpty()) {
                        // Central-only admin user
                        return redirect()->route('dashboard');
                    } elseif ($tenants->count() === 1) {
                        // Single tenant - redirect to tenant
                        $tenant = $tenants->first();

                        return app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class)
                            ->redirectToTenant($tenant, $user);
                    } else {
                        // Multiple tenants - show selection
                        return redirect()->route('tenant.selection');
                    }
                } else {
                    // On tenant domain - redirect to tenant dashboard
                    return redirect()->route('dashboard');
                }
            }
        }

        return $next($request);
    }
}
