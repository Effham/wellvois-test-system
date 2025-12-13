<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Laravel\Cashier\Cashier;

class SubscriptionPlanController extends Controller
{
    /**
     * Display a listing of plans
     */
    public function index(Request $request)
    {
        // $this->authorize('view-plans');

        $search = $request->input('search', '');
        $perPage = $request->input('perPage', 10);

        $query = SubscriptionPlan::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $plans = $query->withCount('tenants')->orderBy('sort_order')->orderBy('created_at', 'desc')->paginate($perPage);

        // Add computed attributes to each plan
        $plans->getCollection()->transform(function ($plan) {
            return array_merge($plan->toArray(), [
                'billing_cycle' => $plan->billing_cycle,
                'formatted_price' => $plan->formatted_price,
                'tenants_count' => $plan->tenants_count ?? 0,
            ]);
        });

        return Inertia::render('Plans/Index', [
            'plans' => $plans,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Show the form for creating a new plan
     *
     * @deprecated Plans are now managed via ENV and `php artisan plans:sync`
     */
    public function create()
    {
        abort(404, 'Plan creation via UI is disabled. Use php artisan plans:sync to manage plans via ENV.');
    }

    /**
     * Store a newly created plan
     *
     * @deprecated Plans are now managed via ENV and `php artisan plans:sync`
     */
    public function store(Request $request)
    {
        abort(404, 'Plan creation via UI is disabled. Use php artisan plans:sync to manage plans via ENV.');

        // Deprecated code below - kept for reference
        /*
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|unique:subscription_plans,slug|max:255',
            'price' => 'required|numeric|min:0',
            'billing_interval' => 'required|in:month,year',
            'billing_interval_count' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'features' => 'nullable|array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        try {
            // Create plan in database first
            $plan = SubscriptionPlan::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'price' => $validated['price'],
                'currency' => 'usd',
                'billing_interval' => $validated['billing_interval'],
                'billing_interval_count' => $validated['billing_interval_count'],
                'description' => $validated['description'] ?? null,
                'features' => $validated['features'] ?? [],
                'is_active' => $validated['is_active'] ?? true,
                'sort_order' => $validated['sort_order'] ?? 0,
            ]);

            // Always sync with Stripe if configured
            if (config('cashier.secret')) {
                try {
                    // Create product in Stripe
                    $product = Cashier::stripe()->products->create([
                        'name' => $plan->name,
                        'description' => $plan->description,
                    ]);

                    // Create price in Stripe
                    $price = Cashier::stripe()->prices->create([
                        'product' => $product->id,
                        'unit_amount' => $plan->price * 100, // Convert to cents
                        'currency' => $plan->currency,
                        'recurring' => [
                            'interval' => $plan->billing_interval,
                            'interval_count' => $plan->billing_interval_count,
                        ],
                    ]);

                    // Update plan with Stripe IDs
                    $plan->update([
                        'stripe_product_id' => $product->id,
                        'stripe_price_id' => $price->id,
                    ]);

                    \Log::info('Plan synced with Stripe', [
                        'plan_id' => $plan->id,
                        'product_id' => $product->id,
                        'price_id' => $price->id,
                    ]);
                } catch (\Exception $e) {
                    \Log::error('Failed to sync plan with Stripe', [
                        'plan_id' => $plan->id,
                        'error' => $e->getMessage(),
                    ]);

                    // Delete the plan since Stripe sync failed
                    $plan->delete();

                    return back()->withErrors(['error' => 'Failed to sync with Stripe: '.$e->getMessage()]);
                }
            }

            return redirect()->route('billing.settings.plans')->with('success', 'Plan created successfully and synced with Stripe!');
        } catch (\Exception $e) {
            \Log::error('Failed to create plan', ['error' => $e->getMessage()]);

            return back()->withErrors(['error' => 'Failed to create plan: '.$e->getMessage()]);
        }
        */
    }

    /**
     * Show the form for editing a plan
     *
     * @deprecated Plans are now managed via ENV and `php artisan plans:sync`
     */
    public function edit(SubscriptionPlan $plan)
    {
        abort(404, 'Plan editing via UI is disabled. Use php artisan plans:sync to manage plans via ENV.');
    }

    /**
     * Update the specified plan
     *
     * @deprecated Plans are now managed via ENV and `php artisan plans:sync`
     */
    public function update(Request $request, SubscriptionPlan $plan)
    {
        abort(404, 'Plan editing via UI is disabled. Use php artisan plans:sync to manage plans via ENV.');

        // Deprecated code below - kept for reference
        /*
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:subscription_plans,slug,'.$plan->id,
            'price' => 'required|numeric|min:0',
            'billing_interval' => 'required|in:month,year',
            'billing_interval_count' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'features' => 'nullable|array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        try {
            // Update local plan
            $plan->update([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'price' => $validated['price'],
                'billing_interval' => $validated['billing_interval'],
                'billing_interval_count' => $validated['billing_interval_count'],
                'description' => $validated['description'] ?? null,
                'features' => $validated['features'] ?? [],
                'is_active' => $validated['is_active'] ?? true,
                'sort_order' => $validated['sort_order'] ?? 0,
            ]);

            // Always sync with Stripe if configured
            if (config('cashier.secret')) {
                try {
                    // Update product in Stripe (if exists)
                    if ($plan->stripe_product_id) {
                        Cashier::stripe()->products->update($plan->stripe_product_id, [
                            'name' => $plan->name,
                            'description' => $plan->description,
                        ]);

                        // Note: Stripe doesn't allow updating prices, so we create a new one
                        $newPrice = Cashier::stripe()->prices->create([
                            'product' => $plan->stripe_product_id,
                            'unit_amount' => $plan->price * 100,
                            'currency' => $plan->currency,
                            'recurring' => [
                                'interval' => $plan->billing_interval,
                                'interval_count' => $plan->billing_interval_count,
                            ],
                        ]);

                        // Archive old price
                        if ($plan->stripe_price_id) {
                            Cashier::stripe()->prices->update($plan->stripe_price_id, [
                                'active' => false,
                            ]);
                        }

                        $plan->update(['stripe_price_id' => $newPrice->id]);
                    } else {
                        // Create new product and price if doesn't exist
                        $product = Cashier::stripe()->products->create([
                            'name' => $plan->name,
                            'description' => $plan->description,
                        ]);

                        $price = Cashier::stripe()->prices->create([
                            'product' => $product->id,
                            'unit_amount' => $plan->price * 100,
                            'currency' => $plan->currency,
                            'recurring' => [
                                'interval' => $plan->billing_interval,
                                'interval_count' => $plan->billing_interval_count,
                            ],
                        ]);

                        $plan->update([
                            'stripe_product_id' => $product->id,
                            'stripe_price_id' => $price->id,
                        ]);
                    }
                } catch (\Exception $e) {
                    \Log::error('Failed to sync plan update with Stripe', [
                        'plan_id' => $plan->id,
                        'error' => $e->getMessage(),
                    ]);

                    return back()->withErrors(['error' => 'Failed to sync with Stripe: '.$e->getMessage()]);
                }
            }

            return redirect()->route('billing.settings.plans')->with('success', 'Plan updated successfully and synced with Stripe!');
        } catch (\Exception $e) {
            \Log::error('Failed to update plan', ['error' => $e->getMessage()]);

            return back()->withErrors(['error' => 'Failed to update plan: '.$e->getMessage()]);
        }
        */
    }

    /**
     * Remove the specified plan
     *
     * @deprecated Plans are now managed via ENV and `php artisan plans:sync`
     */
    public function destroy(SubscriptionPlan $plan)
    {
        abort(404, 'Plan deletion via UI is disabled. Use php artisan plans:sync to manage plans via ENV.');

        // Deprecated code below - kept for reference
        /*
        // Check if plan has active subscriptions
        if ($plan->tenants()->count() > 0) {
            return back()->withErrors(['error' => 'Cannot delete plan with active subscriptions. Please deactivate the plan or migrate tenants to another plan first.']);
        }

        try {
            // Archive/deactivate in Stripe first
            if ($plan->stripe_product_id && config('cashier.secret')) {
                try {
                    // Archive the product in Stripe (this will archive all associated prices)
                    Cashier::stripe()->products->update($plan->stripe_product_id, [
                        'active' => false,
                    ]);

                    // Also explicitly archive the price
                    if ($plan->stripe_price_id) {
                        Cashier::stripe()->prices->update($plan->stripe_price_id, [
                            'active' => false,
                        ]);
                    }
                } catch (\Stripe\Exception\InvalidRequestException $e) {
                    // Handle Stripe errors gracefully
                    \Log::warning('Stripe error while deleting plan', [
                        'plan_id' => $plan->id,
                        'error' => $e->getMessage(),
                    ]);

                    return back()->withErrors(['error' => 'Stripe error: '.$e->getMessage()]);
                } catch (\Exception $e) {
                    \Log::error('Failed to deactivate plan in Stripe', [
                        'plan_id' => $plan->id,
                        'error' => $e->getMessage(),
                    ]);

                    return back()->with('warning', 'Plan deleted locally but failed to sync with Stripe: '.$e->getMessage());
                }
            }

            // Delete the plan from database
            $plan->delete();

            return redirect()->route('billing.settings.plans')->with('success', 'Plan deleted successfully and archived in Stripe!');
        } catch (\Exception $e) {
            \Log::error('Failed to delete plan', ['error' => $e->getMessage()]);

            return back()->withErrors(['error' => 'Failed to delete plan: '.$e->getMessage()]);
        }
        */
    }
}
