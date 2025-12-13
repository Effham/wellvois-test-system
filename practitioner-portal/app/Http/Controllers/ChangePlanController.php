<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Laravel\Cashier\Cashier;
use Stripe\Stripe;

class ChangePlanController extends Controller
{
    /**
     * Show change plan page
     */
    public function show(Request $request)
    {
        try {
            Log::info('ChangePlanController@show called - START', [
                'from' => $request->query('from'),
                'tenant_id' => $request->query('tenant_id'),
                'plan_id' => $request->query('plan_id'),
                'plan_slug' => $request->query('plan'),
                'url' => $request->fullUrl(),
                'route_name' => $request->route()?->getName(),
                'is_central_domain' => in_array($request->getHost(), config('tenancy.central_domains', [])),
                'has_tenant_context' => tenant() !== null,
                'user_id' => Auth::id(),
                'user_authenticated' => Auth::check(),
                'method' => $request->method(),
                'headers' => [
                    'X-Inertia' => $request->header('X-Inertia'),
                    'X-Requested-With' => $request->header('X-Requested-With'),
                ],
            ]);

            $from = $request->query('from'); // 'register' or 'billing'
            $currentPlanSlug = $request->query('plan'); // For registration
            $currentPlanId = $request->query('plan_id'); // For billing
            $tenantId = $request->query('tenant_id'); // For billing

            Log::info('ChangePlanController@show - Query parameters parsed', [
                'from' => $from,
                'currentPlanSlug' => $currentPlanSlug,
                'currentPlanId' => $currentPlanId,
                'tenantId' => $tenantId,
            ]);

            // Get all active plans
            $plans = SubscriptionPlan::active()->get()->map(function ($plan) {
            return [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'billing_cycle' => $plan->billing_cycle,
                'billing_interval' => $plan->billing_interval,
                'billing_interval_count' => $plan->billing_interval_count,
                'description' => $plan->description,
                'features' => $plan->features,
            ];
        });

        // Get current plan
        $currentPlan = null;
        if ($from === 'register' && $currentPlanSlug) {
            $currentPlan = SubscriptionPlan::active()
                ->where('slug', $currentPlanSlug)
                ->first();
        } elseif ($from === 'billing' && $currentPlanId) {
            $currentPlan = SubscriptionPlan::find($currentPlanId);
        }

        // Get preserved form data for registration
        $preservedData = null;
        if ($from === 'register' && $request->query('preserve_data') === 'true') {
            $preservedData = [
                'domain' => $request->query('domain'),
                'company_name' => $request->query('company_name'),
                'admin_name' => $request->query('admin_name'),
                'admin_email' => $request->query('admin_email'),
            ];
        }

            Log::info('ChangePlanController@show - Rendering Inertia page', [
                'plans_count' => $plans->count(),
                'current_plan_id' => $currentPlan?->id,
                'tenant_id' => $tenantId,
            ]);

            $response = Inertia::render('ChangePlan', [
                'from' => $from,
                'plans' => $plans,
                'currentPlan' => $currentPlan ? [
                    'id' => $currentPlan->id,
                    'name' => $currentPlan->name,
                    'slug' => $currentPlan->slug,
                    'price' => $currentPlan->price,
                    'formatted_price' => $currentPlan->formatted_price,
                    'billing_cycle' => $currentPlan->billing_cycle,
                    'billing_interval' => $currentPlan->billing_interval,
                    'billing_interval_count' => $currentPlan->billing_interval_count,
                    'description' => $currentPlan->description,
                    'features' => $currentPlan->features,
                ] : null,
                'tenantId' => $tenantId,
                'preservedData' => $preservedData,
            ]);

            Log::info('ChangePlanController@show - Response created successfully');

            return $response;
        } catch (\Exception $e) {
            Log::error('ChangePlanController@show - Exception occurred', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'url' => $request->fullUrl(),
            ]);
            throw $e;
        }
    }

    /**
     * Update plan selection
     */
    public function update(Request $request)
    {
        $from = $request->input('from'); // 'register' or 'billing'
        $planSlug = $request->input('plan_slug');
        $preservedData = $request->input('preserved_data');

        if (! $planSlug) {
            return back()->with('error', 'Please select a plan.');
        }

        $plan = SubscriptionPlan::active()->where('slug', $planSlug)->first();

        if (! $plan) {
            return back()->with('error', 'Selected plan not found.');
        }

        if ($from === 'register') {
            // Redirect back to registration with new plan slug and preserved data
            $queryParams = ['plan' => $planSlug];

            if ($preservedData) {
                foreach ($preservedData as $key => $value) {
                    if ($value) {
                        $queryParams[$key] = $value;
                    }
                }
            }

            return redirect()->route('register', $queryParams);
        } elseif ($from === 'billing') {
            // Update subscription plan in DB
            // Note: For billing flow, user should be authenticated (coming from billing.setup)
            // But we allow unauthenticated access during registration flow
            $user = Auth::user();
            $tenantId = $request->input('tenant_id');

            if (! $tenantId) {
                return back()->with('error', 'Tenant ID is required.');
            }

            $tenant = Tenant::findOrFail($tenantId);

            // If user is authenticated, verify they own this tenant
            if ($user && ! $user->tenants->contains($tenant)) {
                abort(403, 'Unauthorized');
            }
            // If user is not authenticated, allow update (registration flow scenario)

            try {
                // Update tenant's subscription plan
                tenancy()->central(function () use ($tenant, $plan) {
                    $centralTenant = Tenant::find($tenant->id);
                    if ($centralTenant) {
                        $centralTenant->update([
                            'subscription_plan_id' => $plan->id,
                        ]);
                    }
                });

                // Redirect back to billing setup
                return redirect()->route('billing.setup')->with('success', 'Plan updated successfully.');
            } catch (\Exception $e) {
                Log::error('Change plan error', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'tenant_id' => $tenantId,
                    'plan_id' => $plan->id,
                ]);

                return back()->with('error', 'Failed to update plan. Please try again.');
            }
        }

        return back()->with('error', 'Invalid request.');
    }
}
