<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;
use Laravel\Cashier\Cashier;
use Stripe\Stripe;

class BillingController extends Controller
{
    /**
     * Show billing setup page after registration
     * Works on central domain during registration
     */
    public function setup(Request $request)
    {
        $user = Auth::user();

        // Check if user has pending registration data (tenant not created yet)
        $pendingRegistration = session('pending_registration');

        if ($pendingRegistration) {
            // User is in registration flow, tenant hasn't been created yet
            $plan = \App\Models\SubscriptionPlan::findOrFail($pendingRegistration['plan_id']);

            if (! $plan) {
                return Inertia::render('Billing/Setup', [
                    'tenant' => null,
                    'plan' => null,
                    'stripeKey' => config('cashier.key'),
                    'error' => 'Plan not found. Please contact support.',
                    'pendingRegistration' => true,
                ]);
            }

            // Trial period from config
            $trialDays = \App\Services\BillingSettingsService::getTrialDays();

            return Inertia::render('Billing/Setup', [
                'tenant' => null,
                'plan' => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'price' => $plan->price,
                    'formatted_price' => $plan->formatted_price,
                    'billing_cycle' => $plan->billing_cycle,
                    'description' => $plan->description,
                    'features' => $plan->features,
                ],
                'trialDays' => $trialDays,
                'stripeKey' => config('cashier.key'),
                'isReturningUser' => false,
                'pendingRegistration' => true,
                'registrationData' => [
                    'company_name' => $pendingRegistration['company_name'],
                    'domain' => $pendingRegistration['domain'],
                ],
            ]);
        }

        // Existing flow: Get user's tenants
        $userTenants = $user->tenants;

        if ($userTenants->isEmpty()) {
            return redirect()->route('dashboard')->with('error', 'No tenant found');
        }

        // Get the tenant that requires billing setup
        $tenant = $userTenants
            ->where('requires_billing_setup', true)
            ->where('billing_status', 'pending')
            ->sortByDesc('created_at')
            ->first();

        // If no tenant requires billing setup, they've already completed it
        if (! $tenant) {
            // Check if user has any tenants at all
            if ($userTenants->isEmpty()) {
                return redirect()->route('dashboard')->with('error', 'No tenant found');
            }

            // Billing already completed, allow access to dashboard
            $userTenants->each(function ($t) {
                if ($t->requires_billing_setup && $t->billing_status === 'pending') {
                    $t->update([
                        'requires_billing_setup' => false,
                        'billing_status' => 'active',
                    ]);
                }
            });

            return redirect()->route('dashboard')->with('info', 'Your billing is already set up.');
        }

        $plan = $tenant->subscriptionPlan;

        if (! $plan) {
            // Don't redirect to dashboard - show error on billing page instead
            // But still provide tenant data so the component doesn't crash
            return Inertia::render('Billing/Setup', [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->company_name,
                ],
                'plan' => null,
                'stripeKey' => config('cashier.key'),
                'error' => 'Plan not found. Please contact support.',
            ]);
        }

        // Detect if user is returning (tenant created more than 5 minutes ago)
        // This means they closed the Stripe tab and came back later
        $isReturningUser = $tenant->created_at->diffInMinutes(now()) > 5;

        // Trial period from Stripe (with fallback to config default)
        $trialDays = \App\Services\BillingSettingsService::getTrialDays();

        return Inertia::render('Billing/Setup', [
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->company_name,
            ],
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'billing_cycle' => $plan->billing_cycle,
                'description' => $plan->description,
                'features' => $plan->features,
            ],
            'trialDays' => $trialDays,
            'stripeKey' => config('cashier.key'),
            'isReturningUser' => $isReturningUser,
        ]);
    }

    /**
     * Create Stripe Setup Intent for card verification without charging
     * Works on central domain during registration
     */
    public function createSetupIntent(Request $request)
    {
        $user = Auth::user();
        $tenant = Tenant::findOrFail($request->tenant_id);

        // Verify user owns this tenant
        if (! $user->tenants->contains($tenant)) {
            abort(403, 'Unauthorized');
        }

        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        try {
            // Set Stripe API key from Laravel config
            Stripe::setApiKey(config('cashier.secret'));

            // Create or get Stripe customer
            if (! $tenant->stripe_id) {
                $tenant->createAsStripeCustomer([
                    'name' => $tenant->company_name,
                    'email' => $user->email,
                ]);
            }

            // Create Setup Intent to collect payment method without charging
            $setupIntent = \Stripe\SetupIntent::create([
                'customer' => $tenant->stripe_id,
                'payment_method_types' => ['card'],
            ]);

            return response()->json([
                'client_secret' => $setupIntent->client_secret,
            ]);
        } catch (\Exception $e) {
            Log::error('Setup Intent creation error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenant->id,
                'stripe_customer_id' => $tenant->stripe_id,
                'stripe_secret_configured' => ! empty(config('cashier.secret')),
            ]);

            return response()->json([
                'error' => 'Failed to create setup intent. Please try again.',
                'message' => config('app.debug') ? $e->getMessage() : 'Failed to create setup intent. Please try again.',
            ], 500);
        }
    }

    /**
     * Create Stripe Checkout Session for initial setup (on central domain)
     * Works on central domain during registration
     */
    public function createSetupCheckoutSession(Request $request)
    {
        $user = Auth::user();
        $pendingRegistration = session('pending_registration');

        // Check if this is a pending registration (no tenant created yet)
        if ($pendingRegistration) {
            $plan = SubscriptionPlan::findOrFail($pendingRegistration['plan_id']);

            if (! $plan->stripe_price_id) {
                Log::error('Plan missing Stripe price ID', [
                    'plan_id' => $plan->id,
                    'plan_name' => $plan->name,
                ]);

                return back()->with('error', 'This plan is not configured for billing yet. Please contact support.');
            }

            try {
                // Set Stripe API key from Laravel config
                Stripe::setApiKey(config('cashier.secret'));

                // Create Stripe customer directly (without tenant)
                $stripeCustomer = \Stripe\Customer::create([
                    'email' => $user->email,
                    'name' => $pendingRegistration['admin_name'],
                    'metadata' => [
                        'pending_registration' => true,
                        'user_id' => $user->id,
                    ],
                ]);

                // Store Stripe customer ID in session for later tenant creation
                session(['pending_registration.stripe_customer_id' => $stripeCustomer->id]);

                // Get trial days
                $trialDays = \App\Services\BillingSettingsService::getTrialDays();

                // Create checkout session directly using Stripe API
                $checkoutSession = \Stripe\Checkout\Session::create([
                    'customer' => $stripeCustomer->id,
                    'payment_method_types' => ['card'],
                    'line_items' => [[
                        'price' => $plan->stripe_price_id,
                        'quantity' => 1,
                    ]],
                    'mode' => 'subscription',
                    'subscription_data' => [
                        'trial_period_days' => $trialDays,
                    ],
                    'success_url' => route('billing.checkout-success').'?session_id={CHECKOUT_SESSION_ID}',
                    'cancel_url' => route('billing.setup'),
                ]);

                if (! $checkoutSession || ! $checkoutSession->url) {
                    throw new \Exception('Failed to create checkout session.');
                }

                // Return JSON response with checkout URL for frontend to redirect
                // Inertia can't handle external redirects, so we return the URL
                return response()->json([
                    'checkout_url' => $checkoutSession->url,
                ]);
            } catch (\Exception $e) {
                Log::error('Setup Checkout Session creation error (pending registration)', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'plan_id' => $plan->id,
                    'stripe_secret_configured' => ! empty(config('cashier.secret')),
                ]);

                return back()->with('error', config('app.debug')
                    ? 'Failed to create checkout session: '.$e->getMessage()
                    : 'Failed to create checkout session. Please try again.');
            }
        }

        // Existing flow: tenant already exists
        $tenant = Tenant::findOrFail($request->tenant_id);

        // Verify user owns this tenant
        if (! $user->tenants->contains($tenant)) {
            abort(403, 'Unauthorized');
        }

        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        if (! $plan->stripe_price_id) {
            Log::error('Plan missing Stripe price ID', [
                'plan_id' => $plan->id,
                'plan_name' => $plan->name,
            ]);

            return back()->with('error', 'This plan is not configured for billing yet. Please contact support.');
        }

        try {
            // Set Stripe API key from Laravel config
            Stripe::setApiKey(config('cashier.secret'));

            // Ensure tenant has Stripe customer ID
            if (! $tenant->stripe_id) {
                $tenant->createAsStripeCustomer([
                    'name' => $tenant->company_name,
                    'email' => $user->email,
                ]);
                $tenant->refresh();
            }

            // Get trial days
            $trialDays = \App\Services\BillingSettingsService::getTrialDays();

            // Create checkout session with trial period
            // Use trialUntil() with explicit end date to ensure exactly the requested number of days
            // Note: customer_email is not needed since we already have a customer (stripe_id)
            $checkout = $tenant->newSubscription('default', $plan->stripe_price_id)
                ->trialUntil(now()->addDays($trialDays)->endOfDay())
                ->checkout([
                    'success_url' => route('billing.checkout-success').'?session_id={CHECKOUT_SESSION_ID}',
                    'cancel_url' => route('billing.setup'),
                    'payment_method_types' => ['card'],
                ]);

            if (! $checkout) {
                throw new \Exception('Failed to create checkout session.');
            }

            // Return JSON response with checkout URL for frontend to redirect
            // Inertia can't handle external redirects, so we return the URL
            return response()->json([
                'checkout_url' => $checkout->url,
            ]);
        } catch (\Exception $e) {
            Log::error('Setup Checkout Session creation error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'stripe_secret_configured' => ! empty(config('cashier.secret')),
            ]);

            return back()->with('error', config('app.debug')
                ? 'Failed to create checkout session: '.$e->getMessage()
                : 'Failed to create checkout session. Please try again.');
        }
    }

    /**
     * Handle Checkout Session success (on central domain)
     * Works on central domain during registration
     */
    public function handleCheckoutSuccess(Request $request)
    {
        $user = Auth::user();
        $sessionId = $request->query('session_id');

        if (! $sessionId) {
            Log::error('Checkout success - missing session_id', [
                'request_data' => $request->all(),
            ]);

            return redirect()->route('billing.setup')->with('error', 'Invalid checkout session.');
        }

        try {
            // Set Stripe API key from Laravel config
            Stripe::setApiKey(config('cashier.secret'));

            // Retrieve checkout session from Stripe
            $session = \Stripe\Checkout\Session::retrieve($sessionId);

            if (! $session || $session->mode !== 'subscription') {
                throw new \Exception('Invalid checkout session.');
            }

            // Get tenant from customer ID
            $customerId = $session->customer;
            if (! $customerId) {
                throw new \Exception('Customer ID not found in session.');
            }

            $tenant = Tenant::where('stripe_id', $customerId)->first();

            // If tenant doesn't exist, create it from pending registration data
            if (! $tenant) {
                $pendingRegistration = session('pending_registration');

                if (! $pendingRegistration) {
                    throw new \Exception('Pending registration data not found. Please start registration again.');
                }

                // Verify the Stripe customer ID matches
                $sessionStripeCustomerId = session('pending_registration.stripe_customer_id');
                if ($sessionStripeCustomerId !== $customerId) {
                    Log::warning('Stripe customer ID mismatch', [
                        'session_customer_id' => $sessionStripeCustomerId,
                        'checkout_customer_id' => $customerId,
                    ]);
                }

                // Create tenant using helper method
                $tenantController = app(\App\Http\Controllers\TenantController::class);
                $tenant = $tenantController->createTenantWithSetup($pendingRegistration, $customerId);

                // Clear pending registration from session
                session()->forget('pending_registration');
                session()->forget('pending_registration.stripe_customer_id');

                Log::info('Tenant created after Stripe checkout', [
                    'tenant_id' => $tenant->id,
                    'stripe_customer_id' => $customerId,
                ]);
            }

            // Verify user owns this tenant
            if (! $user->tenants->contains($tenant)) {
                abort(403, 'Unauthorized');
            }

            // Get subscription from session
            $subscriptionId = $session->subscription;
            if (! $subscriptionId) {
                throw new \Exception('Subscription ID not found in session.');
            }

            // Get trial days
            $trialDays = \App\Services\BillingSettingsService::getTrialDays();

            // Retrieve subscription to check trial status
            $subscription = \Stripe\Subscription::retrieve($subscriptionId);
            $isOnTrial = $subscription->trial_end && $subscription->trial_end > time();
            $trialEndsAt = $isOnTrial && $subscription->trial_end ?
                \Carbon\Carbon::createFromTimestamp($subscription->trial_end) : null;

            // Update tenant billing status
            $tenant->update([
                'requires_billing_setup' => false,
                'billing_status' => $isOnTrial ? 'trial' : 'active',
                'billing_completed_at' => now(),
                'on_trial' => $isOnTrial,
                'trial_ends_at' => $trialEndsAt,
                'subscribed_at' => now(),
            ]);

            // Redirect to tenant creation loading page (which will redirect to dashboard)
            // This shows the setup animation even though tenant is already created
            return redirect()->route('billing.tenant-creation')
                ->with('success', "Card verified successfully! Your {$trialDays}-day free trial has started. Enjoy exploring!");
        } catch (\Exception $e) {
            Log::error('Checkout success handling error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'session_id' => $sessionId,
            ]);

            return redirect()->route('billing.setup')->with('error', config('app.debug')
                ? 'Failed to process checkout: '.$e->getMessage()
                : 'Failed to process checkout. Please try again.');
        }
    }

    /**
     * Show tenant creation loading page
     * This page displays the setup animation and redirects to dashboard
     */
    public function tenantCreation(Request $request)
    {
        // Check if coming from Stripe checkout (registration flow)
        $sessionId = $request->query('session_id');
        $registrationUuid = $request->query('registration_uuid') ?? session('registration_uuid');

        Log::info('Tenant creation page accessed', [
            'session_id' => $sessionId,
            'registration_uuid' => $registrationUuid,
            'has_session_id' => ! empty($sessionId),
            'has_registration_uuid' => ! empty($registrationUuid),
            'user_authenticated' => Auth::check(),
            'all_query_params' => $request->query(),
            'session_registration_uuid' => session('registration_uuid'),
        ]);

        if ($sessionId) {
            // NEW FLOW: Coming from Stripe checkout after payment
            // Webhook is creating the tenant, we need to poll for completion
            try {
                Log::info('Tenant creation page: Stripe redirect flow', [
                    'session_id' => $sessionId,
                ]);

                Stripe::setApiKey(config('cashier.secret'));
                $session = \Stripe\Checkout\Session::retrieve($sessionId);

                // Get registration UUID from session metadata
                $registrationUuid = $session->metadata->registration_uuid ?? null;

                if (! $registrationUuid) {
                    Log::error('Tenant creation page: No registration UUID in session metadata', [
                        'session_id' => $sessionId,
                    ]);

                    return redirect()->route('register')->with('error', 'Registration data not found.');
                }

                Log::info('Tenant creation page: Retrieved registration UUID from session', [
                    'session_id' => $sessionId,
                    'registration_uuid' => $registrationUuid,
                ]);

                // Retrieve token from pending registration
                $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                    ->where('expires_at', '>', now())
                    ->first();

                if (! $pendingRegistration) {
                    Log::error('Tenant creation page: Pending registration not found or expired', [
                        'registration_uuid' => $registrationUuid,
                    ]);

                    return redirect()->route('register')->with('error', 'Registration expired.');
                }

                // Validate and decrypt registration data
                $registrationData = \App\Services\RegistrationDataService::validateToken($pendingRegistration->encrypted_token);

                if (! $registrationData) {
                    Log::error('Tenant creation page: Invalid registration token', [
                        'registration_uuid' => $registrationUuid,
                    ]);

                    return redirect()->route('register')->with('error', 'Invalid registration data.');
                }

                // Check if tenant already exists (webhook may have created it)
                $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                // If tenant doesn't exist and we have a session_id, check Stripe directly
                if (! $tenant && $sessionId) {
                    try {
                        Stripe::setApiKey(config('cashier.secret'));
                        $session = \Stripe\Checkout\Session::retrieve($sessionId);

                        // If session is complete and has customer/subscription, trigger tenant creation
                        if ($session->status === 'complete' && $session->customer && $session->subscription) {
                            Log::info('Found completed checkout session, triggering tenant creation', [
                                'session_id' => $sessionId,
                                'registration_uuid' => $registrationUuid,
                            ]);

                            // Manually trigger tenant creation using webhook logic
                            $webhookController = new \App\Http\Controllers\StripeWebhookController;
                            $reflection = new \ReflectionClass($webhookController);
                            $method = $reflection->getMethod('handleCheckoutSessionCompleted');
                            $method->setAccessible(true);
                            $method->invoke($webhookController, $session);

                            // Refresh tenant check
                            $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();
                        }
                    } catch (\Exception $e) {
                        Log::error('Error checking Stripe session for tenant creation', [
                            'error' => $e->getMessage(),
                            'session_id' => $sessionId,
                            'trace' => $e->getTraceAsString(),
                        ]);
                        // Continue - will show loading page and wait for webhook
                    }
                }

                if ($tenant) {
                    // Tenant exists! Authenticate user and redirect to dashboard
                    Log::info('Tenant already exists, authenticating user', [
                        'tenant_id' => $tenant->id,
                        'email' => $registrationData['admin_email'],
                    ]);

                    // Find user by email
                    $user = \App\Models\User::where('email', $registrationData['admin_email'])->first();

                    if (! $user) {
                        Log::error('Tenant creation: User not found', [
                            'email' => $registrationData['admin_email'],
                            'tenant_id' => $tenant->id,
                        ]);

                        return redirect()->route('register')->with('error', 'User account not found. Please contact support.');
                    }

                    // Authenticate user
                    Auth::login($user);
                    Session::regenerate();
                    session(['login_time' => now()->timestamp]);

                    Log::info('User authenticated after tenant creation', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'tenant_id' => $tenant->id,
                    ]);

                    // Clean up session data
                    session()->forget(['registration_uuid', 'registration_email', 'registration_tenant_id']);

                    // Clean up pending registration
                    $pendingRegistration->delete();

                    // Redirect to tenant dashboard
                    return app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class)
                        ->redirectToTenant($tenant, $user);
                }

                // Tenant doesn't exist yet - show loading page (will auto-refresh)
                Log::info('Tenant creation page: Tenant not created yet, showing loading page', [
                    'session_id' => $sessionId,
                    'registration_uuid' => $registrationUuid,
                    'email' => $registrationData['admin_email'],
                ]);

                return Inertia::render('Billing/TenantCreation', [
                    'sessionId' => $sessionId,
                    'registrationUuid' => $registrationUuid,
                    'email' => $registrationData['admin_email'],
                    'companyName' => $registrationData['company_name'] ?? null,
                    'polling' => false, // No polling, will auto-refresh
                    'tenant' => null, // Will be created by webhook
                ]);
            } catch (\Exception $e) {
                Log::error('Tenant creation page error', [
                    'error' => $e->getMessage(),
                    'session_id' => $sessionId,
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->route('register')->with('error', 'An error occurred. Please try again.');
            }
        }

        // Handle Payment Links flow (no session_id, but have registration_uuid from session)
        if ($registrationUuid) {
            try {
                Log::info('Tenant creation page: Payment Link flow', [
                    'registration_uuid' => $registrationUuid,
                ]);

                // Retrieve token from pending registration
                $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                    ->where('expires_at', '>', now())
                    ->first();

                if (! $pendingRegistration) {
                    Log::error('Tenant creation page: Pending registration not found or expired', [
                        'registration_uuid' => $registrationUuid,
                    ]);

                    return redirect()->route('register')->with('error', 'Registration expired. Please start again.');
                }

                // Validate and decrypt registration data
                $registrationData = \App\Services\RegistrationDataService::validateToken($pendingRegistration->encrypted_token);

                if (! $registrationData) {
                    Log::error('Tenant creation page: Invalid registration token', [
                        'registration_uuid' => $registrationUuid,
                    ]);

                    return redirect()->route('register')->with('error', 'Invalid registration data.');
                }

                // Check if tenant already exists (webhook may have created it)
                $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                // If tenant doesn't exist, check Stripe directly for completed payments
                // Payment Links create payment intents, not checkout sessions
                if (! $tenant) {
                    try {
                        Log::info('Checking Stripe for completed payment', [
                            'registration_uuid' => $registrationUuid,
                            'email' => $registrationData['admin_email'],
                            'tenant_id' => $registrationData['tenant_id'] ?? null,
                            'encrypted_token_length' => strlen($pendingRegistration->encrypted_token),
                        ]);

                        Stripe::setApiKey(config('cashier.secret'));

                        // Payment Links create payment intents, so check those first
                        // Also check by customer email since Payment Links might not store client_reference_id
                        // NOTE: Stripe API doesn't support 'status' parameter for PaymentIntent::all()
                        // We'll fetch all recent payment intents and filter by status manually
                        Log::info('Fetching payment intents from Stripe', [
                            'limit' => 100,
                            'registration_uuid' => $registrationUuid,
                        ]);

                        $paymentIntents = \Stripe\PaymentIntent::all([
                            'limit' => 100,
                        ]);

                        $succeededCount = 0;
                        $totalCount = count($paymentIntents->data);

                        Log::info('Payment intents fetched from Stripe', [
                            'total_count' => $totalCount,
                            'registration_uuid' => $registrationUuid,
                        ]);

                        $foundPayment = false;
                        $checkedCount = 0;
                        foreach ($paymentIntents->data as $paymentIntent) {
                            $checkedCount++;

                            Log::info('Checking payment intent', [
                                'payment_intent_id' => $paymentIntent->id,
                                'status' => $paymentIntent->status,
                                'amount' => $paymentIntent->amount ?? null,
                                'currency' => $paymentIntent->currency ?? null,
                                'customer_id' => $paymentIntent->customer ?? null,
                                'created' => $paymentIntent->created ?? null,
                                'checked_count' => $checkedCount,
                                'total_count' => $totalCount,
                            ]);

                            // Only process succeeded payment intents
                            if ($paymentIntent->status !== 'succeeded') {
                                Log::info('Skipping payment intent - status not succeeded', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'status' => $paymentIntent->status,
                                ]);

                                continue;
                            }

                            $succeededCount++;

                            // Check if payment intent has our token in metadata or description
                            $hasToken = false;
                            $tokenMatchSource = null;

                            // Check metadata.client_reference_id (should contain UUID, not full token)
                            if (isset($paymentIntent->metadata->client_reference_id)) {
                                $clientRefId = $paymentIntent->metadata->client_reference_id;

                                Log::info('Checking metadata.client_reference_id', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'metadata_client_reference_id' => $clientRefId,
                                    'registration_uuid' => $pendingRegistration->id,
                                    'client_ref_length' => strlen($clientRefId),
                                    'matches_uuid' => $clientRefId === $pendingRegistration->id,
                                    'matches_token' => $clientRefId === $pendingRegistration->encrypted_token,
                                ]);

                                // Check if it matches UUID (new approach) or token (legacy)
                                if ($clientRefId === $pendingRegistration->id || $clientRefId === $pendingRegistration->encrypted_token) {
                                    $hasToken = true;
                                    $tokenMatchSource = $clientRefId === $pendingRegistration->id
                                        ? 'metadata.client_reference_id (UUID)'
                                        : 'metadata.client_reference_id (token)';
                                }
                            }

                            // Check metadata.registration_token
                            if (! $hasToken && isset($paymentIntent->metadata->registration_token)) {
                                Log::info('Checking metadata.registration_token', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'metadata_registration_token' => $paymentIntent->metadata->registration_token,
                                    'expected_token_length' => strlen($pendingRegistration->encrypted_token),
                                    'matches' => $paymentIntent->metadata->registration_token === $pendingRegistration->encrypted_token,
                                ]);

                                if ($paymentIntent->metadata->registration_token === $pendingRegistration->encrypted_token) {
                                    $hasToken = true;
                                    $tokenMatchSource = 'metadata.registration_token';
                                }
                            }

                            // Check description
                            if (! $hasToken && $paymentIntent->description) {
                                Log::info('Checking description field', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'description' => $paymentIntent->description,
                                    'expected_token_length' => strlen($pendingRegistration->encrypted_token),
                                    'matches' => $paymentIntent->description === $pendingRegistration->encrypted_token,
                                ]);

                                if ($paymentIntent->description === $pendingRegistration->encrypted_token) {
                                    $hasToken = true;
                                    $tokenMatchSource = 'description';
                                }
                            }

                            // Check if customer email matches (fallback for Payment Links)
                            if (! $hasToken && $paymentIntent->customer) {
                                try {
                                    Log::info('Checking customer email match (fallback)', [
                                        'payment_intent_id' => $paymentIntent->id,
                                        'customer_id' => $paymentIntent->customer,
                                        'registration_email' => $registrationData['admin_email'],
                                    ]);

                                    $customer = \Stripe\Customer::retrieve($paymentIntent->customer);

                                    Log::info('Customer retrieved', [
                                        'payment_intent_id' => $paymentIntent->id,
                                        'customer_id' => $customer->id,
                                        'customer_email' => $customer->email ?? null,
                                        'registration_email' => $registrationData['admin_email'],
                                        'email_matches' => $customer->email === $registrationData['admin_email'],
                                    ]);

                                    if ($customer->email === $registrationData['admin_email']) {
                                        // Check if payment was recent (within last 10 minutes)
                                        $paymentTime = $paymentIntent->created;
                                        $timeDiff = $paymentTime ? (now()->timestamp - $paymentTime) : null;
                                        $isRecent = $paymentTime && $timeDiff < 600;

                                        Log::info('Customer email matches, checking payment time', [
                                            'payment_intent_id' => $paymentIntent->id,
                                            'payment_time' => $paymentTime,
                                            'time_diff_seconds' => $timeDiff,
                                            'is_recent' => $isRecent,
                                            'threshold_seconds' => 600,
                                        ]);

                                        if ($isRecent) {
                                            Log::info('Found payment intent by customer email match (recent payment)', [
                                                'payment_intent_id' => $paymentIntent->id,
                                                'customer_email' => $customer->email,
                                                'registration_email' => $registrationData['admin_email'],
                                                'time_diff_seconds' => $timeDiff,
                                            ]);
                                            $hasToken = true; // Use email match as fallback
                                            $tokenMatchSource = 'customer_email_match';
                                        } else {
                                            Log::info('Payment intent found by email but payment is too old', [
                                                'payment_intent_id' => $paymentIntent->id,
                                                'time_diff_seconds' => $timeDiff,
                                                'threshold_seconds' => 600,
                                            ]);
                                        }
                                    }
                                } catch (\Exception $e) {
                                    Log::warning('Could not retrieve customer for payment intent', [
                                        'payment_intent_id' => $paymentIntent->id,
                                        'customer_id' => $paymentIntent->customer,
                                        'error' => $e->getMessage(),
                                        'trace' => $e->getTraceAsString(),
                                    ]);
                                }
                            }

                            if ($hasToken) {
                                Log::info('Found completed payment intent in Stripe, triggering tenant creation', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'registration_uuid' => $registrationUuid,
                                    'customer_id' => $paymentIntent->customer,
                                    'token_match_source' => $tokenMatchSource,
                                    'succeeded_payment_intents_checked' => $succeededCount,
                                ]);

                                // Manually trigger tenant creation using webhook logic
                                try {
                                    $webhookController = new \App\Http\Controllers\StripeWebhookController;
                                    $reflection = new \ReflectionClass($webhookController);
                                    $method = $reflection->getMethod('handlePaymentIntentSucceeded');
                                    $method->setAccessible(true);
                                    $method->invoke($webhookController, $paymentIntent);

                                    Log::info('Tenant creation triggered successfully', [
                                        'payment_intent_id' => $paymentIntent->id,
                                        'registration_uuid' => $registrationUuid,
                                    ]);
                                } catch (\Exception $e) {
                                    Log::error('Failed to trigger tenant creation', [
                                        'payment_intent_id' => $paymentIntent->id,
                                        'registration_uuid' => $registrationUuid,
                                        'error' => $e->getMessage(),
                                        'trace' => $e->getTraceAsString(),
                                    ]);
                                }

                                // Retry mechanism: Wait and re-check tenant existence
                                $maxRetries = 3;
                                $retryDelay = 2; // seconds
                                $tenantFound = false;

                                for ($retry = 1; $retry <= $maxRetries; $retry++) {
                                    Log::info('Checking tenant existence after trigger', [
                                        'retry_attempt' => $retry,
                                        'max_retries' => $maxRetries,
                                        'expected_tenant_id' => $registrationData['tenant_id'],
                                    ]);

                                    // Wait before checking (except on first attempt)
                                    if ($retry > 1) {
                                        sleep($retryDelay);
                                    }

                                    // Refresh tenant check
                                    $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                                    if ($tenant) {
                                        Log::info('Tenant found after manual trigger', [
                                            'tenant_id' => $tenant->id,
                                            'payment_intent_id' => $paymentIntent->id,
                                            'retry_attempt' => $retry,
                                        ]);
                                        $tenantFound = true;
                                        break;
                                    } else {
                                        Log::warning('Tenant not found after manual trigger', [
                                            'expected_tenant_id' => $registrationData['tenant_id'],
                                            'payment_intent_id' => $paymentIntent->id,
                                            'retry_attempt' => $retry,
                                            'max_retries' => $maxRetries,
                                        ]);
                                    }
                                }

                                if (! $tenantFound) {
                                    Log::error('Tenant not found after all retry attempts - diagnostic information', [
                                        'expected_tenant_id' => $registrationData['tenant_id'],
                                        'payment_intent_id' => $paymentIntent->id,
                                        'retry_attempts' => $maxRetries,
                                        'registration_uuid' => $registrationUuid,
                                        'admin_email' => $registrationData['admin_email'] ?? null,
                                        'customer_id' => $paymentIntent->customer ?? null,
                                        'payment_status' => $paymentIntent->status ?? null,
                                        'payment_amount' => $paymentIntent->amount ?? null,
                                        'payment_currency' => $paymentIntent->currency ?? null,
                                        'payment_created' => $paymentIntent->created ?? null,
                                        'diagnostic_message' => 'Payment exists but tenant creation failed. Check webhook logs for tenant creation errors.',
                                    ]);

                                    // Check if user exists - might be able to authenticate anyway
                                    $user = \App\Models\User::where('email', $registrationData['admin_email'])->first();
                                    if ($user) {
                                        Log::info('User exists but tenant creation failed - user can still authenticate', [
                                            'user_id' => $user->id,
                                            'email' => $user->email,
                                            'expected_tenant_id' => $registrationData['tenant_id'],
                                        ]);
                                    } else {
                                        Log::warning('User also does not exist - tenant creation completely failed', [
                                            'email' => $registrationData['admin_email'] ?? null,
                                            'expected_tenant_id' => $registrationData['tenant_id'],
                                        ]);
                                    }
                                }

                                $foundPayment = true;
                                break;
                            } else {
                                Log::info('Payment intent does not match registration token', [
                                    'payment_intent_id' => $paymentIntent->id,
                                    'metadata' => $paymentIntent->metadata ? json_decode(json_encode($paymentIntent->metadata), true) : null,
                                    'description' => $paymentIntent->description ?? null,
                                ]);
                            }
                        }

                        Log::info('Payment intent check completed', [
                            'total_checked' => $checkedCount,
                            'succeeded_count' => $succeededCount,
                            'found_payment' => $foundPayment,
                            'registration_uuid' => $registrationUuid,
                        ]);

                        // Fallback: Check checkout sessions (for Checkout Sessions, not Payment Links)
                        if (! $foundPayment) {
                            Log::info('Checking checkout sessions as fallback', [
                                'registration_uuid' => $registrationUuid,
                                'limit' => 100,
                            ]);

                            $checkoutSessions = \Stripe\Checkout\Session::all([
                                'limit' => 100,
                                'status' => 'complete',
                            ], [
                                'expand' => ['data.customer', 'data.subscription'],
                            ]);

                            Log::info('Checkout sessions fetched', [
                                'count' => count($checkoutSessions->data),
                                'registration_uuid' => $registrationUuid,
                            ]);

                            $sessionCheckedCount = 0;
                            foreach ($checkoutSessions->data as $session) {
                                $sessionCheckedCount++;

                                Log::info('Checking checkout session', [
                                    'session_id' => $session->id,
                                    'client_reference_id' => $session->client_reference_id ?? null,
                                    'customer_id' => $session->customer ?? null,
                                    'subscription_id' => $session->subscription ?? null,
                                    'status' => $session->status ?? null,
                                    'checked_count' => $sessionCheckedCount,
                                    'total_count' => count($checkoutSessions->data),
                                ]);

                                // Check if this session matches our registration UUID
                                // client_reference_id contains UUID, not full token
                                if ($session->client_reference_id === $pendingRegistration->id) {
                                    Log::info('Found completed checkout session in Stripe, triggering tenant creation', [
                                        'session_id' => $session->id,
                                        'registration_uuid' => $registrationUuid,
                                        'client_reference_id' => $session->client_reference_id,
                                    ]);

                                    // Manually trigger tenant creation using webhook logic
                                    try {
                                        $webhookController = new \App\Http\Controllers\StripeWebhookController;
                                        $reflection = new \ReflectionClass($webhookController);
                                        $method = $reflection->getMethod('handleCheckoutSessionCompleted');
                                        $method->setAccessible(true);
                                        $method->invoke($webhookController, $session);

                                        Log::info('Tenant creation triggered from checkout session', [
                                            'session_id' => $session->id,
                                            'registration_uuid' => $registrationUuid,
                                        ]);
                                    } catch (\Exception $e) {
                                        Log::error('Failed to trigger tenant creation from checkout session', [
                                            'session_id' => $session->id,
                                            'registration_uuid' => $registrationUuid,
                                            'error' => $e->getMessage(),
                                            'trace' => $e->getTraceAsString(),
                                        ]);
                                    }

                                    // Retry mechanism: Wait and re-check tenant existence
                                    $maxRetries = 3;
                                    $retryDelay = 2; // seconds
                                    $tenantFound = false;

                                    for ($retry = 1; $retry <= $maxRetries; $retry++) {
                                        Log::info('Checking tenant existence after checkout session trigger', [
                                            'retry_attempt' => $retry,
                                            'max_retries' => $maxRetries,
                                            'expected_tenant_id' => $registrationData['tenant_id'],
                                            'session_id' => $session->id,
                                        ]);

                                        // Wait before checking (except on first attempt)
                                        if ($retry > 1) {
                                            sleep($retryDelay);
                                        }

                                        // Refresh tenant check
                                        $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                                        if ($tenant) {
                                            Log::info('Tenant found after checkout session trigger', [
                                                'tenant_id' => $tenant->id,
                                                'session_id' => $session->id,
                                                'retry_attempt' => $retry,
                                            ]);
                                            $tenantFound = true;
                                            break;
                                        } else {
                                            Log::warning('Tenant not found after checkout session trigger', [
                                                'expected_tenant_id' => $registrationData['tenant_id'],
                                                'session_id' => $session->id,
                                                'retry_attempt' => $retry,
                                                'max_retries' => $maxRetries,
                                            ]);
                                        }
                                    }

                                    if (! $tenantFound) {
                                        Log::error('Tenant not found after all retry attempts (checkout session) - diagnostic information', [
                                            'expected_tenant_id' => $registrationData['tenant_id'],
                                            'session_id' => $session->id,
                                            'retry_attempts' => $maxRetries,
                                            'registration_uuid' => $registrationUuid,
                                            'admin_email' => $registrationData['admin_email'] ?? null,
                                            'customer_id' => $session->customer ?? null,
                                            'subscription_id' => $session->subscription ?? null,
                                            'payment_status' => $session->payment_status ?? null,
                                            'session_status' => $session->status ?? null,
                                            'amount_total' => $session->amount_total ?? null,
                                            'currency' => $session->currency ?? null,
                                            'diagnostic_message' => 'Payment exists but tenant creation failed. Check webhook logs for tenant creation errors.',
                                        ]);

                                        // Check if user exists - might be able to authenticate anyway
                                        $user = \App\Models\User::where('email', $registrationData['admin_email'])->first();
                                        if ($user) {
                                            Log::info('User exists but tenant creation failed (checkout session) - user can still authenticate', [
                                                'user_id' => $user->id,
                                                'email' => $user->email,
                                                'expected_tenant_id' => $registrationData['tenant_id'],
                                                'session_id' => $session->id,
                                            ]);
                                        } else {
                                            Log::warning('User also does not exist (checkout session) - tenant creation completely failed', [
                                                'email' => $registrationData['admin_email'] ?? null,
                                                'expected_tenant_id' => $registrationData['tenant_id'],
                                                'session_id' => $session->id,
                                            ]);
                                        }
                                    }

                                    break;
                                } else {
                                    Log::info('Checkout session does not match registration token', [
                                        'session_id' => $session->id,
                                        'client_reference_id' => $session->client_reference_id ?? null,
                                        'expected_token_length' => strlen($pendingRegistration->encrypted_token),
                                    ]);
                                }
                            }

                            Log::info('Checkout session check completed', [
                                'total_checked' => $sessionCheckedCount,
                                'registration_uuid' => $registrationUuid,
                            ]);
                        }

                        // Fallback: Check by customer email (if payment completed but we can't find it by token)
                        if (! $tenant) {
                            try {
                                Log::info('Checking customers by email as final fallback', [
                                    'email' => $registrationData['admin_email'],
                                    'registration_uuid' => $registrationUuid,
                                    'limit' => 10,
                                ]);

                                // Search for customers with this email
                                $customers = \Stripe\Customer::all([
                                    'limit' => 10,
                                    'email' => $registrationData['admin_email'],
                                ]);

                                Log::info('Customers found by email', [
                                    'count' => count($customers->data),
                                    'email' => $registrationData['admin_email'],
                                ]);

                                foreach ($customers->data as $customer) {
                                    Log::info('Checking customer subscriptions', [
                                        'customer_id' => $customer->id,
                                        'customer_email' => $customer->email ?? null,
                                        'registration_email' => $registrationData['admin_email'],
                                    ]);

                                    // Check if customer has active subscriptions
                                    $subscriptions = \Stripe\Subscription::all([
                                        'customer' => $customer->id,
                                        'status' => 'active',
                                        'limit' => 10,
                                    ]);

                                    Log::info('Customer subscriptions retrieved', [
                                        'customer_id' => $customer->id,
                                        'subscription_count' => count($subscriptions->data),
                                    ]);

                                    if (count($subscriptions->data) > 0) {
                                        Log::info('Found customer with active subscription, creating tenant', [
                                            'customer_id' => $customer->id,
                                            'email' => $registrationData['admin_email'],
                                            'registration_uuid' => $registrationUuid,
                                            'subscription_id' => $subscriptions->data[0]->id ?? null,
                                        ]);

                                        // Create tenant manually using registration data
                                        // This is a fallback - webhook should have handled this
                                        $subscription = $subscriptions->data[0];

                                        // Create central user first
                                        Log::info('Creating central user for fallback tenant creation', [
                                            'email' => $registrationData['admin_email'],
                                        ]);

                                        $centralUser = \App\Models\User::firstOrCreate(
                                            ['email' => $registrationData['admin_email']],
                                            [
                                                'name' => $registrationData['admin_name'],
                                                'password' => $registrationData['admin_password'], // Already hashed
                                                'email_verified_at' => now(),
                                            ]
                                        );

                                        Log::info('Central user created/found', [
                                            'user_id' => $centralUser->id,
                                            'email' => $centralUser->email,
                                            'was_recently_created' => $centralUser->wasRecentlyCreated,
                                        ]);

                                        // Use TenantController to create tenant with full setup
                                        Log::info('Creating tenant via TenantController', [
                                            'tenant_id' => $registrationData['tenant_id'],
                                            'customer_id' => $customer->id,
                                        ]);

                                        $tenantController = app(\App\Http\Controllers\TenantController::class);
                                        $createdTenant = $tenantController->createTenantWithSetup([
                                            'tenant_id' => $registrationData['tenant_id'],
                                            'company_name' => $registrationData['company_name'],
                                            'domain' => $registrationData['domain'],
                                            'admin_name' => $registrationData['admin_name'],
                                            'admin_email' => $registrationData['admin_email'],
                                            'admin_password' => $registrationData['admin_password'],
                                            'plan_id' => $registrationData['plan_id'],
                                            'user_id' => $centralUser->id,
                                        ], $customer->id);

                                        Log::info('Tenant created via TenantController', [
                                            'tenant_id' => $createdTenant->id,
                                            'customer_id' => $customer->id,
                                        ]);

                                        // Update tenant with subscription info
                                        $createdTenant->update([
                                            'stripe_id' => $customer->id,
                                            'billing_status' => 'active',
                                            'requires_billing_setup' => false,
                                            'billing_completed_at' => now(),
                                            'subscribed_at' => now(),
                                        ]);

                                        Log::info('Tenant updated with subscription info', [
                                            'tenant_id' => $createdTenant->id,
                                            'billing_status' => 'active',
                                        ]);

                                        $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                                        if ($tenant) {
                                            Log::info('Tenant verified after fallback creation', [
                                                'tenant_id' => $tenant->id,
                                            ]);
                                        } else {
                                            Log::error('Tenant not found after fallback creation', [
                                                'expected_tenant_id' => $registrationData['tenant_id'],
                                            ]);
                                        }

                                        break;
                                    } else {
                                        Log::info('Customer has no active subscriptions', [
                                            'customer_id' => $customer->id,
                                        ]);
                                    }
                                }
                            } catch (\Exception $e) {
                                Log::error('Error checking customer by email', [
                                    'error' => $e->getMessage(),
                                    'email' => $registrationData['admin_email'],
                                    'trace' => $e->getTraceAsString(),
                                ]);
                            }
                        }

                        if (! $tenant) {
                            Log::info('No completed payment found in Stripe yet - comprehensive diagnostic', [
                                'registration_uuid' => $registrationUuid,
                                'email' => $registrationData['admin_email'],
                                'tenant_id' => $registrationData['tenant_id'] ?? null,
                                'checked_payment_intents' => true,
                                'checked_checkout_sessions' => true,
                                'checked_customers_by_email' => true,
                                'encrypted_token_length' => strlen($pendingRegistration->encrypted_token),
                                'pending_registration_expires_at' => $pendingRegistration->expires_at ?? null,
                                'diagnostic_message' => 'No payment found matching registration. Payment may not be completed yet, or webhook may not have fired.',
                                'next_steps' => [
                                    '1. Verify payment was completed in Stripe Dashboard',
                                    '2. Check if webhook endpoint is receiving events',
                                    '3. Verify registration token is stored in payment metadata',
                                    '4. Check webhook logs for processing errors',
                                ],
                            ]);

                            // Additional diagnostic: Check if any payment intents exist for this customer email
                            try {
                                $customers = \Stripe\Customer::all([
                                    'limit' => 5,
                                    'email' => $registrationData['admin_email'],
                                ]);

                                if (count($customers->data) > 0) {
                                    Log::info('Found customers with matching email but no matching payment', [
                                        'email' => $registrationData['admin_email'],
                                        'customer_count' => count($customers->data),
                                        'customer_ids' => array_map(fn ($c) => $c->id, $customers->data),
                                    ]);

                                    foreach ($customers->data as $customer) {
                                        $customerPaymentIntents = \Stripe\PaymentIntent::all([
                                            'customer' => $customer->id,
                                            'limit' => 10,
                                        ]);

                                        Log::info('Customer payment intents', [
                                            'customer_id' => $customer->id,
                                            'payment_intent_count' => count($customerPaymentIntents->data),
                                            'payment_intent_ids' => array_map(fn ($pi) => $pi->id, $customerPaymentIntents->data),
                                            'payment_intent_statuses' => array_map(fn ($pi) => $pi->status, $customerPaymentIntents->data),
                                        ]);
                                    }
                                }
                            } catch (\Exception $e) {
                                Log::warning('Could not perform additional diagnostic check', [
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        } else {
                            Log::info('Tenant found after Stripe payment check', [
                                'tenant_id' => $tenant->id,
                                'registration_uuid' => $registrationUuid,
                                'billing_status' => $tenant->billing_status,
                                'stripe_id' => $tenant->stripe_id,
                            ]);
                        }
                    } catch (\Exception $e) {
                        Log::error('Error checking Stripe for payment status - comprehensive error details', [
                            'error' => $e->getMessage(),
                            'error_class' => get_class($e),
                            'registration_uuid' => $registrationUuid,
                            'email' => $registrationData['admin_email'] ?? null,
                            'tenant_id' => $registrationData['tenant_id'] ?? null,
                            'trace' => $e->getTraceAsString(),
                            'file' => $e->getFile(),
                            'line' => $e->getLine(),
                            'diagnostic_message' => 'Stripe API call failed. Check API key, network connectivity, and Stripe service status.',
                        ]);
                        // Continue - will show loading page and wait for webhook
                    }
                }

                if ($tenant) {
                    // Tenant exists! Check if creation is complete before authenticating
                    Log::info('Tenant already exists, checking creation status', [
                        'tenant_id' => $tenant->id,
                        'email' => $registrationData['admin_email'],
                        'registration_uuid' => $registrationUuid,
                        'billing_status' => $tenant->billing_status,
                    ]);

                    // Check if tenant creation is complete from tenant_user table (central DB)
                    $isComplete = \Illuminate\Support\Facades\DB::table('tenant_user')
                        ->where('tenant_id', $tenant->id)
                        ->value('is_tenant_creation_complete') ?? false;

                    // If not complete, redirect to status page to wait for job
                    if (! $isComplete) {
                        Log::info('Tenant creation not complete, redirecting to status page', [
                            'tenant_id' => $tenant->id,
                            'registration_uuid' => $registrationUuid,
                        ]);

                        return redirect()->route('tenant-creation.status', [
                            'tenant_id' => $tenant->id,
                            'registration_uuid' => $registrationUuid,
                        ]);
                    }

                    // Creation is complete, proceed with authentication
                    Log::info('Tenant creation complete, authenticating user', [
                        'tenant_id' => $tenant->id,
                        'email' => $registrationData['admin_email'],
                        'registration_uuid' => $registrationUuid,
                    ]);

                    // Find user by email (use withoutGlobalScopes as safety measure)
                    $user = \App\Models\User::withoutGlobalScopes()->where('email', $registrationData['admin_email'])->first();

                    if (! $user) {
                        Log::error('Tenant creation: User not found - diagnostic information', [
                            'email' => $registrationData['admin_email'],
                            'tenant_id' => $tenant->id,
                            'registration_uuid' => $registrationUuid,
                            'diagnostic_message' => 'Tenant exists but user was not created. This indicates tenant setup may have failed partially.',
                            'next_steps' => [
                                '1. Check tenant setup logs for user creation errors',
                                '2. Verify tenant database migrations completed',
                                '3. Check if user exists in tenant database',
                                '4. Consider manual user creation or tenant re-setup',
                            ],
                        ]);

                        return redirect()->route('register')->with('error', 'User account not found. Please contact support.');
                    }

                    // Verify user is associated with tenant
                    try {
                        tenancy()->initialize($tenant);
                        // Use withoutGlobalScopes as safety measure during creation phase
                        $tenantUser = \App\Models\User::withoutGlobalScopes()->where('email', $registrationData['admin_email'])->first();
                        tenancy()->end();

                        if (! $tenantUser) {
                            Log::warning('User exists in central database but not in tenant database', [
                                'user_id' => $user->id,
                                'email' => $user->email,
                                'tenant_id' => $tenant->id,
                                'registration_uuid' => $registrationUuid,
                            ]);
                        } else {
                            Log::info('User verified in both central and tenant databases', [
                                'user_id' => $user->id,
                                'tenant_user_id' => $tenantUser->id,
                                'tenant_id' => $tenant->id,
                            ]);
                        }
                    } catch (\Exception $e) {
                        Log::warning('Could not verify user in tenant database', [
                            'user_id' => $user->id,
                            'tenant_id' => $tenant->id,
                            'error' => $e->getMessage(),
                        ]);
                        // Continue with authentication anyway
                    }

                    // Authenticate user
                    try {
                        Auth::login($user);
                        Session::regenerate();
                        session(['login_time' => now()->timestamp]);

                        Log::info('User authenticated after tenant creation', [
                            'user_id' => $user->id,
                            'email' => $user->email,
                            'tenant_id' => $tenant->id,
                            'registration_uuid' => $registrationUuid,
                        ]);
                    } catch (\Exception $e) {
                        Log::error('Failed to authenticate user after tenant creation', [
                            'user_id' => $user->id,
                            'email' => $user->email,
                            'tenant_id' => $tenant->id,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);

                        return redirect()->route('register')->with('error', 'Authentication failed. Please try logging in manually.');
                    }

                    // Clean up session data
                    session()->forget(['registration_uuid', 'registration_email', 'registration_tenant_id']);

                    // CRITICAL: Verify tenant_user relationship exists before SSO redirect
                    // This prevents SSO failures due to race conditions where relationship
                    // hasn't been committed yet after tenant creation
                    $maxRetries = 5;
                    $retryDelay = 0.5; // 500ms
                    $relationshipExists = false;

                    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
                        // Refresh user to get latest relationships
                        $user->refresh();

                        // Check relationship via Eloquent
                        $relationshipExists = $user->tenants()->where('tenant_id', $tenant->id)->exists();

                        // If not found, try direct DB query (handles race conditions)
                        if (! $relationshipExists) {
                            $relationshipExists = \DB::table('tenant_user')
                                ->where('user_id', $user->id)
                                ->where('tenant_id', $tenant->id)
                                ->exists();
                        }

                        if ($relationshipExists) {
                            Log::info('Tenant-user relationship verified before SSO redirect', [
                                'user_id' => $user->id,
                                'tenant_id' => $tenant->id,
                                'attempt' => $attempt,
                            ]);
                            break;
                        }

                        if ($attempt < $maxRetries) {
                            Log::warning('Tenant-user relationship not found, retrying', [
                                'user_id' => $user->id,
                                'tenant_id' => $tenant->id,
                                'attempt' => $attempt,
                                'max_retries' => $maxRetries,
                            ]);
                            usleep($retryDelay * 1000000); // Convert to microseconds
                        }
                    }

                    if (! $relationshipExists) {
                        Log::error('Tenant-user relationship not found after retries - cannot proceed with SSO', [
                            'user_id' => $user->id,
                            'tenant_id' => $tenant->id,
                            'email' => $user->email,
                            'registration_uuid' => $registrationUuid,
                            'max_retries' => $maxRetries,
                        ]);

                        // Try to create the relationship manually as last resort
                        try {
                            if (! $user->tenants()->where('tenant_id', $tenant->id)->exists()) {
                                $user->tenants()->attach($tenant->id);
                                Log::info('Manually created tenant-user relationship', [
                                    'user_id' => $user->id,
                                    'tenant_id' => $tenant->id,
                                ]);
                                $relationshipExists = true;
                            }
                        } catch (\Exception $e) {
                            Log::error('Failed to manually create tenant-user relationship', [
                                'user_id' => $user->id,
                                'tenant_id' => $tenant->id,
                                'error' => $e->getMessage(),
                            ]);
                        }

                        if (! $relationshipExists) {
                            return redirect()->route('register')->with('error', 'Account setup incomplete. Please contact support.');
                        }
                    }

                    // Clean up pending registration
                    try {
                        $pendingRegistration->delete();
                        Log::info('Pending registration cleaned up', [
                            'registration_uuid' => $registrationUuid,
                        ]);
                    } catch (\Exception $e) {
                        Log::warning('Failed to delete pending registration', [
                            'registration_uuid' => $registrationUuid,
                            'error' => $e->getMessage(),
                        ]);
                        // Continue - not critical
                    }

                    // Redirect to tenant dashboard (relationship now verified)
                    try {
                        return app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class)
                            ->redirectToTenant($tenant, $user);
                    } catch (\Exception $e) {
                        Log::error('Failed to redirect to tenant dashboard', [
                            'user_id' => $user->id,
                            'tenant_id' => $tenant->id,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);

                        // Fallback redirect
                        return redirect()->route('tenant.selection')->with('success', 'Registration completed successfully!');
                    }
                }

                // Tenant doesn't exist yet - show loading page (will auto-refresh)
                Log::info('Tenant creation page: Tenant not created yet, showing loading page', [
                    'registration_uuid' => $registrationUuid,
                    'email' => $registrationData['admin_email'],
                ]);

                return Inertia::render('Billing/TenantCreation', [
                    'sessionId' => null, // No session_id for Payment Links
                    'registrationUuid' => $registrationUuid,
                    'email' => $registrationData['admin_email'],
                    'companyName' => $registrationData['company_name'] ?? null,
                    'polling' => false, // No polling, will auto-refresh
                    'tenant' => null, // Will be created by webhook
                ]);
            } catch (\Exception $e) {
                Log::error('Tenant creation page error (Payment Link flow)', [
                    'error' => $e->getMessage(),
                    'registration_uuid' => $registrationUuid,
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->route('register')->with('error', 'An error occurred. Please try again.');
            }
        }

        // If no session_id and no registration_uuid, this is likely a direct access or missing Stripe redirect
        if (! Auth::check()) {
            Log::warning('Tenant creation page accessed without session_id, registration_uuid, and without authentication', [
                'query_params' => $request->query(),
            ]);

            return redirect()->route('register')->with('error', 'Invalid access. Please complete the registration process.');
        }

        // EXISTING FLOW: For authenticated users (billing setup)
        $user = Auth::user();

        // Get user's tenants to verify tenant was created
        $userTenants = $user->tenants;

        if ($userTenants->isEmpty()) {
            return redirect()->route('billing.setup')->with('error', 'Tenant creation failed. Please try again.');
        }

        // Get the most recently created tenant
        $tenant = $userTenants->sortByDesc('created_at')->first();

        return Inertia::render('Billing/TenantCreation', [
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->company_name,
            ],
            'polling' => false,
        ]);
    }

    /**
     * Handle Setup Intent success - save payment method and start trial
     * Works on central domain during registration
     *
     * @deprecated Use handleCheckoutSuccess instead
     */
    public function handleSetupIntentSuccess(Request $request)
    {
        $user = Auth::user();
        $tenant = Tenant::findOrFail($request->tenant_id);

        // Verify user owns this tenant
        if (! $user->tenants->contains($tenant)) {
            abort(403, 'Unauthorized');
        }

        $plan = SubscriptionPlan::findOrFail($request->plan_id);
        $paymentMethodId = $request->input('payment_method_id');

        if (! $paymentMethodId) {
            Log::error('Setup Intent success - missing payment_method_id', [
                'request_data' => $request->all(),
                'tenant_id' => $tenant->id,
            ]);

            return back()->with('error', 'Payment method is required.');
        }

        // Ensure payment_method_id is a string (in case it comes as object)
        if (is_array($paymentMethodId) || is_object($paymentMethodId)) {
            $paymentMethodId = is_array($paymentMethodId) ? ($paymentMethodId['id'] ?? $paymentMethodId[0] ?? null) : ($paymentMethodId->id ?? null);
        }

        if (! $paymentMethodId || ! is_string($paymentMethodId)) {
            Log::error('Setup Intent success - invalid payment_method_id format', [
                'payment_method_id' => $request->input('payment_method_id'),
                'tenant_id' => $tenant->id,
            ]);

            return back()->with('error', 'Invalid payment method format.');
        }

        try {
            // Set Stripe API key from Laravel config
            Stripe::setApiKey(config('cashier.secret'));

            // Ensure tenant has Stripe customer ID
            if (! $tenant->stripe_id) {
                $tenant->createAsStripeCustomer([
                    'name' => $tenant->company_name,
                    'email' => $user->email,
                ]);
            }

            // Retrieve payment method to check if it's attached
            $paymentMethod = \Stripe\PaymentMethod::retrieve($paymentMethodId);

            // Attach payment method to customer if not already attached
            // Setup Intent with customer should auto-attach, but we'll ensure it's attached
            if (! $paymentMethod->customer || $paymentMethod->customer !== $tenant->stripe_id) {
                $paymentMethod->attach([
                    'customer' => $tenant->stripe_id,
                ]);
            }

            // Set payment method as default for customer using Cashier
            $tenant->updateDefaultPaymentMethod($paymentMethodId);

            // Refresh tenant to get updated payment method info
            $tenant->refresh();

            // Get trial days from Stripe (with fallback to config default)
            $trialDays = \App\Services\BillingSettingsService::getTrialDays();

            // Get plan from central database
            $plan = null;
            tenancy()->central(function () use ($request, &$plan) {
                $plan = SubscriptionPlan::findOrFail($request->plan_id);
            });

            if (! $plan) {
                throw new \Exception('Plan not found.');
            }

            // Create subscription with trial period using Cashier's built-in trialDays() method
            // According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing#subscription-trials
            tenancy()->central(function () use ($tenant, $plan, $trialDays) {
                $centralTenant = \App\Models\Tenant::find($tenant->id);
                if (! $centralTenant) {
                    throw new \Exception('Tenant not found in central database.');
                }

                // Create subscription with trial period using Cashier's trialDays() method
                // According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing#subscription-trials
                if (! $plan->stripe_price_id) {
                    throw new \Exception('Plan Stripe price ID not found.');
                }

                $subscription = $centralTenant->newSubscription('default', $plan->stripe_price_id)
                    ->trialDays($trialDays) // Use Cashier's trialDays() method per documentation
                    ->create();

                // Refresh tenant to get updated payment method info
                $centralTenant->refresh();

                // Get trial_ends_at from the subscription (Cashier stores it on Subscription model)
                $trialEndsAt = $subscription->trial_ends_at;

                // Update tenant billing status and sync trial_ends_at from subscription
                $centralTenant->update([
                    'requires_billing_setup' => false,
                    'billing_status' => 'trial',
                    'on_trial' => true,
                    'trial_ends_at' => $trialEndsAt, // Sync from subscription to tenant model
                ]);
            });

            return redirect()->route('dashboard')
                ->with('success', "Card verified successfully! Your {$trialDays}-day free trial has started. Enjoy exploring!");
        } catch (\Exception $e) {
            Log::error('Setup Intent success handling error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenant->id,
                'payment_method_id' => $paymentMethodId,
                'stripe_secret_configured' => ! empty(config('cashier.secret')),
            ]);

            return back()->with('error', config('app.debug')
                ? 'Failed to save payment method: '.$e->getMessage()
                : 'Failed to save payment method. Please try again.');
        }
    }

    /**
     * Create Stripe Checkout Session (for after trial ends)
     * Works in tenant context - checks for existing payment method first
     */
    public function createCheckoutSession(Request $request)
    {
        // Must be in tenant context
        if (! tenant()) {
            abort(403, 'This page is only available in tenant context.');
        }

        $tenant = tenant();
        $user = Auth::user();

        // Check if user is admin in tenant context
        $tenantUser = \App\Models\User::where('email', $user->email)->first();
        if (! $tenantUser || ! $tenantUser->hasRole('Admin')) {
            abort(403, 'Only administrators can manage subscriptions.');
        }

        // Get plan from central database
        $plan = null;
        tenancy()->central(function () use ($request, &$plan) {
            $plan = SubscriptionPlan::findOrFail($request->plan_id);
        });

        if (! $plan) {
            abort(404, 'Plan not found.');
        }

        if (! $plan->stripe_price_id) {
            Log::error('Plan missing Stripe price ID', [
                'plan_id' => $plan->id,
                'plan_name' => $plan->name,
            ]);

            return back()->with('error', 'This plan is not configured for billing yet. Please contact support.');
        }

        try {
            // Verify Stripe secret is configured
            $stripeSecret = config('cashier.secret');
            if (empty($stripeSecret)) {
                Log::error('Stripe secret not configured');

                return back()->with('error', 'Payment processing is not configured. Please contact support.');
            }

            // Set Stripe API key from Laravel config
            Stripe::setApiKey($stripeSecret);

            // Cashier will automatically use the Stripe key from config
            // Verify Cashier can access Stripe
            if (! Cashier::stripe()) {
                Log::error('Cashier Stripe client not initialized', [
                    'stripe_secret_configured' => ! empty($stripeSecret),
                ]);

                return back()->with('error', 'Payment processing initialization failed. Please try again.');
            }

            // Get central tenant for Stripe operations
            $centralTenant = null;
            $hasPaymentMethod = false;
            tenancy()->central(function () use ($tenant, $user, &$centralTenant, &$hasPaymentMethod) {
                $centralTenant = \App\Models\Tenant::find($tenant->id);
                if (! $centralTenant) {
                    abort(404, 'Tenant not found in central database.');
                }

                // Create or get Stripe customer
                if (! $centralTenant->stripe_id) {
                    $centralTenant->createAsStripeCustomer([
                        'name' => $centralTenant->company_name,
                        'email' => $user->email,
                    ]);
                    $centralTenant->refresh();
                }

                // Check if customer has a default payment method
                try {
                    $customer = \Stripe\Customer::retrieve($centralTenant->stripe_id);
                    $hasPaymentMethod = ! empty($customer->invoice_settings->default_payment_method);
                } catch (\Exception $e) {
                    Log::warning('Failed to check payment method', ['error' => $e->getMessage()]);
                }
            });

            // If payment method exists, use resubscribe instead
            if ($hasPaymentMethod) {
                return $this->resubscribe($request);
            }

            // Get trial days from Stripe for checkout session
            $trialDays = \App\Services\BillingSettingsService::getTrialDays();

            // Create checkout session using central tenant (for new payment method)
            // According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing#subscription-trials
            $checkout = null;
            tenancy()->central(function () use ($centralTenant, $plan, $trialDays, &$checkout) {
                if (! $centralTenant) {
                    throw new \Exception('Tenant not found in central database.');
                }

                if (! $plan || ! $plan->stripe_price_id) {
                    throw new \Exception('Plan or Stripe price ID not found.');
                }

                // Use trialUntil() with explicit end date to ensure exactly the requested number of days
                $checkout = $centralTenant->newSubscription('default', $plan->stripe_price_id)
                    ->trialUntil(now()->addDays($trialDays)->endOfDay())
                    ->checkout([
                        'success_url' => route('billing.success').'?session_id={CHECKOUT_SESSION_ID}',
                        'cancel_url' => route('dashboard'),
                        'payment_method_types' => ['card'],
                    ]);
            });

            if (! $checkout) {
                throw new \Exception('Failed to create checkout session.');
            }

            // Return JSON response with checkout URL for frontend to redirect
            // Inertia can't handle external redirects, so we return the URL
            return response()->json([
                'checkout_url' => $checkout->url,
            ]);
        } catch (\Exception $e) {
            Log::error('Billing checkout error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenant->id ?? null,
                'plan_id' => $plan->id ?? null,
                'stripe_price_id' => $plan->stripe_price_id ?? null,
                'stripe_secret_configured' => ! empty(config('cashier.secret')),
            ]);

            return back()->with('error', config('app.debug')
                ? 'Failed to create checkout session: '.$e->getMessage()
                : 'Failed to create checkout session. Please try again.');
        }
    }

    /**
     * Resubscribe using existing payment method (after trial expires)
     * Works in tenant context
     */
    public function resubscribe(Request $request)
    {
        // Must be in tenant context
        if (! tenant()) {
            abort(403, 'This page is only available in tenant context.');
        }

        $tenant = tenant();
        $user = Auth::user();

        // Check if user is admin in tenant context
        $tenantUser = \App\Models\User::where('email', $user->email)->first();
        if (! $tenantUser || ! $tenantUser->hasRole('Admin')) {
            abort(403, 'Only administrators can manage subscriptions.');
        }

        // Get plan from central database
        $plan = null;
        tenancy()->central(function () use ($request, &$plan) {
            $plan = SubscriptionPlan::findOrFail($request->plan_id);
        });

        if (! $plan || ! $plan->stripe_price_id) {
            return back()->with('error', 'Plan not found or not configured for billing.');
        }

        try {
            // Set Stripe API key from Laravel config
            Stripe::setApiKey(config('cashier.secret'));

            // Get central tenant and create subscription using existing payment method
            tenancy()->central(function () use ($tenant, $plan) {
                $centralTenant = \App\Models\Tenant::find($tenant->id);
                if (! $centralTenant || ! $centralTenant->stripe_id) {
                    throw new \Exception('Tenant or Stripe customer not found.');
                }

                // Create subscription using default payment method
                $centralTenant->newSubscription('default', $plan->stripe_price_id)
                    ->create();

                // Update tenant billing status
                $centralTenant->update([
                    'requires_billing_setup' => false,
                    'billing_completed_at' => now(),
                    'billing_status' => 'active',
                    'subscribed_at' => now(),
                    'on_trial' => false,
                ]);
            });

            return redirect()->route('billing.success')
                ->with('success', 'Subscription activated successfully using your saved payment method!');
        } catch (\Exception $e) {
            Log::error('Resubscribe error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id ?? null,
            ]);

            return back()->with('error', config('app.debug')
                ? 'Failed to activate subscription: '.$e->getMessage()
                : 'Failed to activate subscription. Please try again or use checkout to add a new payment method.');
        }
    }

    /**
     * Handle successful payment
     * Works in tenant context
     * According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing
     */
    public function success(Request $request)
    {
        // Must be in tenant context
        if (! tenant()) {
            abort(403, 'This page is only available in tenant context.');
        }

        $tenant = tenant();

        // Update tenant billing status in central database
        // Cashier automatically creates subscription and manages trial_ends_at via webhooks
        tenancy()->central(function () use ($tenant) {
            $centralTenant = \App\Models\Tenant::find($tenant->id);
            if ($centralTenant) {
                // Get the subscription created by Cashier to check trial status
                $subscription = $centralTenant->subscription('default');

                if ($subscription) {
                    // Check if subscription is on trial (Cashier manages this)
                    $isOnTrial = $subscription->onTrial();
                    $trialEndsAt = $subscription->trial_ends_at;

                    $centralTenant->update([
                        'requires_billing_setup' => false,
                        'billing_completed_at' => now(),
                        'billing_status' => $isOnTrial ? 'trial' : 'active',
                        'subscribed_at' => now(),
                        'on_trial' => $isOnTrial,
                        'trial_ends_at' => $trialEndsAt, // Use Cashier's managed trial_ends_at
                    ]);
                } else {
                    // Fallback if subscription not found yet (webhook might not have processed)
                    $centralTenant->update([
                        'requires_billing_setup' => false,
                        'billing_completed_at' => now(),
                        'billing_status' => 'active',
                        'subscribed_at' => now(),
                    ]);
                }
            }
        });

        return redirect()->route('dashboard')->with('success', 'Subscription activated successfully! Welcome to Wellovis.');
    }

    /**
     * Show access blocked page when subscription has ended
     * Works in tenant context
     */
    public function accessBlocked(Request $request)
    {
        // Must be in tenant context
        if (! tenant()) {
            abort(403, 'This page is only available in tenant context.');
        }

        $tenant = tenant();
        $user = Auth::user();

        // Get tenant subscription info from central database
        $subscription = null;
        $plan = null;
        $isAdmin = false;

        tenancy()->central(function () use ($tenant, $user, &$subscription, &$plan, &$isAdmin) {
            $centralTenant = \App\Models\Tenant::find($tenant->id);
            if ($centralTenant) {
                $subscription = $centralTenant->subscription('default');
                $plan = $centralTenant->subscriptionPlan;

                // Check if user is admin in this tenant
                $isAdmin = $centralTenant->isUserAdmin($user);
            }
        });

        return Inertia::render('Billing/AccessBlocked', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
            ],
            'subscription' => $subscription ? [
                'id' => $subscription->id,
                'stripe_id' => $subscription->stripe_id,
                'stripe_status' => $subscription->stripe_status,
                'ends_at' => $subscription->ends_at?->toISOString(),
                'canceled' => $subscription->canceled(),
            ] : null,
            'plan' => $plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'billing_cycle' => $plan->billing_cycle,
            ] : null,
            'isAdmin' => $isAdmin,
            'stripeKey' => config('cashier.key'),
        ]);
    }

    /**
     * Update payment method and charge immediately
     * Works in tenant context
     */
    public function updatePaymentMethod(Request $request)
    {
        // Must be in tenant context
        if (! tenant()) {
            abort(403, 'This page is only available in tenant context.');
        }

        $tenant = tenant();
        $user = Auth::user();

        // Verify user is admin
        $isAdmin = false;
        tenancy()->central(function () use ($tenant, $user, &$isAdmin) {
            $centralTenant = \App\Models\Tenant::find($tenant->id);
            if ($centralTenant) {
                $isAdmin = $centralTenant->isUserAdmin($user);
            }
        });

        if (! $isAdmin) {
            abort(403, 'Only administrators can update payment methods.');
        }

        $validated = $request->validate([
            'payment_method_id' => 'required|string',
        ]);

        try {
            Stripe::setApiKey(config('cashier.secret'));

            // Get tenant subscription and plan from central database
            $subscription = null;
            $plan = null;
            tenancy()->central(function () use ($tenant, &$subscription, &$plan) {
                $centralTenant = \App\Models\Tenant::find($tenant->id);
                if ($centralTenant) {
                    $subscription = $centralTenant->subscription('default');
                    $plan = $centralTenant->subscriptionPlan;
                }
            });

            if (! $subscription || ! $plan) {
                return back()->withErrors(['error' => 'No active subscription found.']);
            }

            // Update payment method and charge immediately
            tenancy()->central(function () use ($tenant, $validated, $subscription, $plan) {
                $centralTenant = \App\Models\Tenant::find($tenant->id);
                if (! $centralTenant || ! $centralTenant->stripe_id) {
                    throw new \Exception('Tenant or Stripe customer not found.');
                }

                // Attach payment method to customer
                $paymentMethod = \Stripe\PaymentMethod::retrieve($validated['payment_method_id']);
                $paymentMethod->attach(['customer' => $centralTenant->stripe_id]);

                // Set as default payment method
                $centralTenant->updateDefaultPaymentMethod($validated['payment_method_id']);

                // If subscription is canceled/ended, we need to create a new subscription
                if ($subscription->canceled() || $subscription->ended()) {
                    // Cancel the old subscription completely
                    $subscription->cancelNow();

                    // Create a new subscription with the updated payment method
                    $newSubscription = $centralTenant->newSubscription('default', $plan->stripe_price_id)
                        ->create();

                    // Charge immediately by creating and paying an invoice
                    try {
                        $invoice = $centralTenant->invoice();
                        if ($invoice && $invoice->status !== 'paid') {
                            $invoice->pay();
                        }
                    } catch (\Exception $e) {
                        // If invoice creation fails, subscription will still be active
                        // Stripe will attempt to charge on the next billing cycle
                        Log::warning('Failed to create immediate invoice', [
                            'tenant_id' => $centralTenant->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                } else {
                    // Subscription exists but payment failed - charge immediately
                    try {
                        $invoice = $centralTenant->invoice();
                        if ($invoice && $invoice->status !== 'paid') {
                            $invoice->pay();
                        }
                    } catch (\Exception $e) {
                        Log::warning('Failed to create immediate invoice', [
                            'tenant_id' => $centralTenant->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                // Update tenant billing status
                $centralTenant->update([
                    'requires_billing_setup' => false,
                    'billing_status' => 'active',
                    'on_trial' => false,
                ]);
            });

            return redirect()->route('dashboard')
                ->with('success', 'Payment method updated and subscription reactivated successfully!');
        } catch (\Exception $e) {
            Log::error('Failed to update payment method', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => config('app.debug')
                ? 'Failed to update payment method: '.$e->getMessage()
                : 'Failed to update payment method. Please try again.']);
        }
    }

    /**
     * Show billing portal
     */
    public function portal(Request $request)
    {
        $user = Auth::user();
        $tenant = Tenant::findOrFail($request->tenant_id);

        // Verify user owns this tenant
        if (! $user->tenants->contains($tenant)) {
            abort(403, 'Unauthorized');
        }

        return $tenant->redirectToBillingPortal(route('dashboard'));
    }

    /**
     * Show current subscription details
     */
    public function show(Request $request)
    {
        $user = Auth::user();
        $tenant = Tenant::findOrFail($request->tenant_id);

        // Verify user owns this tenant
        if (! $user->tenants->contains($tenant)) {
            abort(403, 'Unauthorized');
        }

        $subscription = $tenant->subscription('default');

        return Inertia::render('Billing/Show', [
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->company_name,
            ],
            'subscription' => $subscription ? [
                'status' => $subscription->stripe_status,
                'trial_ends_at' => $subscription->trial_ends_at,
                'ends_at' => $subscription->ends_at,
                'on_trial' => $subscription->onTrial(),
                'on_grace_period' => $subscription->onGracePeriod(),
                'canceled' => $subscription->canceled(),
            ] : null,
        ]);
    }
}
