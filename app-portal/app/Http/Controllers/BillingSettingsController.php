<?php

namespace App\Http\Controllers;

use App\Services\BillingSettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Laravel\Cashier\Cashier;
use Stripe\Stripe;

class BillingSettingsController extends Controller
{
    /**
     * Display billing settings page with tabs
     */
    public function index()
    {
        // Default to plans tab
        return redirect()->route('billing.settings.plans');
    }

    /**
     * Display plans tab
     */
    public function plans(Request $request)
    {
        $search = $request->input('search', '');
        $perPage = $request->input('perPage', 10);

        $query = \App\Models\SubscriptionPlan::query();

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

        return Inertia::render('Billing/Settings', [
            'activeTab' => 'plans',
            'plans' => $plans,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Display payment settings tab
     */
    public function payment()
    {
        // Fetch settings from Stripe
        $settings = BillingSettingsService::fetchBillingSettingsFromStripe();

        return Inertia::render('Billing/Settings', [
            'activeTab' => 'payment',
            'maxPaymentAttempts' => $settings['max_payment_attempts'],
            'trialDays' => $settings['trial_days'],
        ]);
    }

    /**
     * Update payment attempts configuration in Stripe
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'max_payment_attempts' => 'required|integer|min:1|max:10',
            'trial_days' => 'required|integer|min:1|max:365',
        ]);

        try {
            Stripe::setApiKey(config('cashier.secret'));

            // Get or create billing settings product
            $product = BillingSettingsService::getBillingSettingsProduct();

            // Update product metadata in Stripe
            Cashier::stripe()->products->update($product->id, [
                'metadata' => [
                    'type' => 'billing_settings',
                    'max_payment_attempts' => (string) $validated['max_payment_attempts'],
                    'trial_days' => (string) $validated['trial_days'],
                ],
            ]);

            Log::info('Billing settings updated in Stripe', [
                'max_payment_attempts' => $validated['max_payment_attempts'],
                'trial_days' => $validated['trial_days'],
            ]);

            return redirect()->route('billing.settings.payment')
                ->with('success', 'Payment settings updated successfully in Stripe!');
        } catch (\Exception $e) {
            Log::error('Failed to update billing settings in Stripe', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'Failed to update settings in Stripe: '.$e->getMessage()]);
        }
    }
}
