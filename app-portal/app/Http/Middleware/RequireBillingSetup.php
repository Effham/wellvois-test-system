<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class RequireBillingSetup
{
    /**
     * Handle an incoming request.
     *
     * Checks if the authenticated user has any tenants that require billing setup.
     * If so, redirects them to complete the billing setup before accessing other areas.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $routeName = $request->route()?->getName();
        $isChangePlan = $request->routeIs('change-plan.*');

        \Illuminate\Support\Facades\Log::info('RequireBillingSetup middleware executing', [
            'route_name' => $routeName,
            'path' => $request->path(),
            'is_change_plan' => $isChangePlan,
            'is_billing_setup' => $request->routeIs('billing.setup'),
            'has_tenant_context' => tenant() !== null,
            'is_central_domain' => in_array($request->getHost(), config('tenancy.central_domains', [])),
            'user_authenticated' => Auth::check(),
        ]);

        // Skip if user is not authenticated
        if (! Auth::check()) {
            \Illuminate\Support\Facades\Log::info('RequireBillingSetup: User not authenticated, allowing request');

            return $next($request);
        }

        // Skip billing setup routes and auth routes to avoid redirect loop
        if (
            $request->routeIs('billing.setup') ||
            $request->routeIs('billing.checkout') ||
            $request->routeIs('billing.success') ||
            $request->routeIs('billing.tenant-creation') ||
            $request->routeIs('billing.resubscribe') ||
            $request->routeIs('billing.setup-intent.*') ||
            $request->routeIs('billing.access-blocked') ||
            $request->routeIs('billing.update-payment-method') ||
            $request->routeIs('change-plan.*') ||
            $request->routeIs('logout') ||
            $request->routeIs('tenant.selection') ||
            $request->routeIs('two-factor-authentication.*') ||
            $request->routeIs('login') ||
            $request->routeIs('register') ||
            $request->routeIs('password.*') ||
            $request->routeIs('sso.central-redirect') ||
            $request->routeIs('keycloak.logged-out') ||
            $request->path() === 'sso/central-redirect' ||
            $request->path() === 'logged-out'
        ) {
            \Illuminate\Support\Facades\Log::info('RequireBillingSetup: Route excluded from billing check', [
                'route_name' => $routeName,
                'is_change_plan' => $isChangePlan,
            ]);

            return $next($request);
        }

        $user = Auth::user();

        // Only check subscription/billing status when in tenant context
        if (tenant()) {
            $currentTenant = tenant();
            $hasSubscriptionEnded = false;
            $billingStatus = null;

            // Check if we're in onboarding flow
            $isOnboardingFlow = $request->query('onboarding') === 'true';
            $isSettingsRoute = $request->routeIs('settings.*');

            // Allow settings routes during onboarding flow (users need to complete onboarding steps before billing)
            if ($isOnboardingFlow && $isSettingsRoute) {
                return $next($request);
            }

            // Check subscription status from central database
            tenancy()->central(function () use ($currentTenant, &$hasSubscriptionEnded, &$billingStatus) {
                $centralTenant = \App\Models\Tenant::find($currentTenant->id);
                if ($centralTenant) {
                    $hasSubscriptionEnded = $centralTenant->hasSubscriptionEnded();
                    $billingStatus = $centralTenant->billing_status;
                }
            });

            // Check if subscription has ended or billing status is canceled
            if ($hasSubscriptionEnded || $billingStatus === 'canceled') {
                // Redirect to access blocked page (stays in tenant context)
                if (! $request->routeIs('billing.access-blocked')) {
                    return redirect()->route('billing.access-blocked');
                }
            }

            // Check if tenant requires billing setup (normal flow)
            if ($currentTenant->requiresBilling()) {
                // Redirect to central domain for billing setup (registration flow)
                $isCentralDomain = in_array($request->getHost(), config('tenancy.central_domains', []));
                if (! $isCentralDomain) {
                    $protocol = app()->environment('production') ? 'https' : 'http';
                    $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
                    $port = app()->environment('production') ? '' : ':8000';
                    $centralUrl = "{$protocol}://{$centralDomain}{$port}";

                    $targetRoute = route('billing.setup', [], false);
                    $redirectUrl = "{$centralUrl}/sso/central-redirect?redirect=".urlencode($targetRoute);

                    return Inertia::location($redirectUrl);
                }
            }
        }

        return $next($request);
    }
}
