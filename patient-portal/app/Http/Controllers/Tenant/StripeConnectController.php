<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\StripeConnectService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StripeConnectController extends Controller
{
    public function __construct(
        protected StripeConnectService $stripeConnectService
    ) {}

    /**
     * Show the onboarding status page
     */
    public function index()
    {
        $tenant = tenancy()->tenant;

        // Refresh requirements from Stripe if account exists
        if ($tenant->stripe_account_id) {
            $this->stripeConnectService->refreshAccountRequirements($tenant);
            $tenant->refresh();
        }

        return Inertia::render('settings/StripeConnect/Status', [
            'tenant' => $tenant,
            'stripeRequirements' => $tenant->stripe_requirements ?? [],
            'isOnboardingComplete' => $tenant->stripe_onboarding_complete,
            'canAcceptPayments' => $tenant->stripe_account_id ?
                $this->stripeConnectService->canAcceptPayments($tenant) : false,
            'canReceivePayouts' => $tenant->stripe_account_id ?
                $this->stripeConnectService->canReceivePayouts($tenant) : false,
        ]);
    }


    /**
     * Redirect to Stripe's hosted onboarding/update page
     */
    public function redirectToStripe(Request $request)
    {
        $tenant = tenancy()->tenant;

        if (! $tenant->stripe_account_id) {
            return back()->withErrors(['error' => 'Stripe account not found. Please contact support.']);
        }

        $returnUrl = route('stripe-connect.status', [], true);
        
        // Determine if this is an update (onboarding already complete) or initial onboarding
        $isUpdate = $tenant->stripe_onboarding_complete;

        $stripeUrl = $this->stripeConnectService->createAccountLink($tenant, $returnUrl, $isUpdate);

        if (! $stripeUrl) {
            return back()->withErrors(['error' => 'Failed to create Stripe link. Please try again.']);
        }

        return redirect()->away($stripeUrl);
    }
}
