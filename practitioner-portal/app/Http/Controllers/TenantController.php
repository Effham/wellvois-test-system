<?php

namespace App\Http\Controllers;

use App\Mail\TenantWelcomeMail;
use App\Models\Tenant;
use App\Models\User;
use App\Services\KeycloakUserService;
use App\Services\RegistrationDataService;
use App\Services\TenantSessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Stripe\Stripe;

class TenantController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-tenants')->only(['index', 'show']);
        $this->middleware('permission:add-tenants')->only(['create']);
        $this->middleware('permission:update-tenants')->only(['edit', 'update']);
        $this->middleware('permission:delete-tenants')->only('destroy');

        // Note: store method handles permission check manually to allow public registration
    }

    public function index(Request $request)
    {
        $perPage = $request->get('perPage', 10);
        $search = $request->get('search');
        $sortBy = $request->get('sortBy', 'created_at');
        $sortOrder = $request->get('sortOrder', 'desc');

        $query = Tenant::with('domains');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhere('data->company_name', 'like', "%{$search}%");
            });
        }

        // Apply sorting
        if ($sortBy === 'created_at') {
            $query->orderBy('created_at', $sortOrder);
        } else {
            $query->orderBy('created_at', 'desc'); // Default to newest first
        }

        $tenants = $query->paginate($perPage)->withQueryString();

        return Inertia::render('Tenants/Index', [
            'tenants' => $tenants,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
                'sortBy' => $sortBy,
                'sortOrder' => $sortOrder,
            ],
        ]);
    }

    /**
     * Show tenant details with subscription information
     */
    public function show(Tenant $tenant)
    {
        // Get subscription plan
        $plan = $tenant->subscriptionPlan;

        // Get current subscription from Cashier
        $subscription = $tenant->subscription('default');

        // Get subscription history from Stripe
        $subscriptionHistory = [];
        $invoices = [];

        if ($tenant->stripe_id) {
            try {
                StripeClient::setApiKey(config('cashier.secret'));

                // Get all subscriptions for this customer from Stripe
                $stripeSubscriptions = \Stripe\Subscription::all([
                    'customer' => $tenant->stripe_id,
                    'limit' => 100,
                ]);

                foreach ($stripeSubscriptions->data as $stripeSubscription) {
                    $subscriptionHistory[] = [
                        'id' => $stripeSubscription->id,
                        'status' => $stripeSubscription->status,
                        'current_period_start' => date('Y-m-d H:i:s', $stripeSubscription->current_period_start),
                        'current_period_end' => date('Y-m-d H:i:s', $stripeSubscription->current_period_end),
                        'trial_start' => $stripeSubscription->trial_start ? date('Y-m-d H:i:s', $stripeSubscription->trial_start) : null,
                        'trial_end' => $stripeSubscription->trial_end ? date('Y-m-d H:i:s', $stripeSubscription->trial_end) : null,
                        'canceled_at' => $stripeSubscription->canceled_at ? date('Y-m-d H:i:s', $stripeSubscription->canceled_at) : null,
                        'created' => date('Y-m-d H:i:s', $stripeSubscription->created),
                    ];
                }

                // Get invoices for this customer
                $stripeInvoices = \Stripe\Invoice::all([
                    'customer' => $tenant->stripe_id,
                    'limit' => 100,
                ]);

                foreach ($stripeInvoices->data as $stripeInvoice) {
                    $invoices[] = [
                        'id' => $stripeInvoice->id,
                        'number' => $stripeInvoice->number,
                        'amount_due' => $stripeInvoice->amount_due / 100, // Convert from cents
                        'amount_paid' => $stripeInvoice->amount_paid / 100,
                        'status' => $stripeInvoice->status,
                        'created' => date('Y-m-d H:i:s', $stripeInvoice->created),
                        'paid_at' => $stripeInvoice->status_transitions->paid_at ? date('Y-m-d H:i:s', $stripeInvoice->status_transitions->paid_at) : null,
                        'subscription' => $stripeInvoice->subscription,
                    ];
                }
            } catch (\Exception $e) {
                \Log::error('Failed to fetch Stripe subscription history', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return Inertia::render('Tenants/Show', [
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name,
                'stripe_id' => $tenant->stripe_id,
                'billing_status' => $tenant->billing_status,
                'on_trial' => $tenant->on_trial,
                'trial_ends_at' => $tenant->trial_ends_at?->toISOString(),
                'requires_billing_setup' => $tenant->requires_billing_setup,
                'billing_completed_at' => $tenant->billing_completed_at?->toISOString(),
                'subscribed_at' => $tenant->subscribed_at?->toISOString(),
                'created_at' => $tenant->created_at->toISOString(),
                'domains' => $tenant->domains->map(fn ($d) => ['domain' => $d->domain]),
            ],
            'plan' => $plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'price' => $plan->price,
                'formatted_price' => $plan->formatted_price,
                'billing_cycle' => $plan->billing_cycle,
            ] : null,
            'subscription' => $subscription ? [
                'id' => $subscription->id,
                'stripe_id' => $subscription->stripe_id,
                'stripe_status' => $subscription->stripe_status,
                'trial_ends_at' => $subscription->trial_ends_at?->toISOString(),
                'ends_at' => $subscription->ends_at?->toISOString(),
                'on_trial' => $subscription->onTrial(),
                'active' => $subscription->active(),
                'canceled' => $subscription->canceled(),
            ] : null,
            'subscriptionHistory' => $subscriptionHistory,
            'invoices' => $invoices,
        ]);
    }

    public function create()
    {
        return Inertia::render('Tenants/Create', [
            'baseDomain' => env('BASE_TENANT_DOMAIN'),
        ]);
    }

    public function store(Request $request)
    {
        // Skip permission check for public registration
        if (! $request->routeIs('register.store')) {
            $this->authorize('add-tenants');
        }

        $request->merge([
            'domain' => $request->domain.'.'.config('tenancy.central_domains')[0],
        ]);

        $validated = $request->validate([
            'domain' => 'required|string|unique:domains,domain|max:255',
            'company_name' => 'required|string|max:255',
            'admin_name' => 'required|string|max:255',
            'admin_email' => [
                'required',
                'email',
                'max:255',
                function ($attribute, $value, $fail) use ($request) {
                    // For public registration, check if email has been verified via OTP
                    if ($request->routeIs('register.store')) {
                        $verification = \App\Models\EmailVerification::where('email', $value)
                            ->where('is_verified', true)
                            ->latest()
                            ->first();

                        if (! $verification) {
                            $fail('Email address has not been verified. Please complete the verification step.');

                            return;
                        }

                        // Check if verification is recent (within last 30 minutes)
                        if ($verification->verified_at->diffInMinutes(now()) > 30) {
                            $fail('Email verification has expired. Please start the registration process again.');

                            return;
                        }
                    }

                    // REMOVED: Email validation that prevents users from registering new tenant
                    // Users can now register multiple tenants with the same email
                    // They will be able to switch between tenants after login
                    // Only check if email exists in CURRENT tenant being created (prevent duplicate in same tenant)
                    // This check happens later during tenant user creation
                },
            ],
            'admin_password' => [
                'required',
                'confirmed',
                Password::min(8)
                    ->letters()
                    ->mixedCase()
                    ->numbers()
                    ->symbols(),
            ],
            'plan_id' => 'required|exists:subscription_plans,id',
        ]);

        // Auto-generate ID from company_name
        $baseId = strtolower(str_replace(' ', '_', $validated['company_name']));
        $baseId = preg_replace('/[^a-z0-9_-]/', '', $baseId); // Remove invalid characters

        // Check for existing IDs and database names (with prefix) and add suffix if needed
        $tenantId = $baseId;
        $counter = 1;
        $dbPrefix = config('tenancy.database.prefix', 'pms_');

        while (Tenant::where('id', $tenantId)->exists() || $this->databaseExists($dbPrefix.$tenantId)) {
            $tenantId = $baseId.'_'.$counter;
            $counter++;
        }

        // Get selected plan
        $plan = \App\Models\SubscriptionPlan::findOrFail($validated['plan_id']);

        // Step 1: Create or get admin user in central DB (SSO identity)
        // If user exists, use existing user but DON'T update name (keep original name)
        // Name will be tenant-specific and stored only in tenant database
        $centralUser = User::firstOrCreate(
            ['email' => $validated['admin_email']],
            [
                'name' => $validated['admin_name'], // Only set name if creating new user
                'password' => bcrypt($validated['admin_password']),
                'email_verified_at' => now(),
            ]
        );

        // If user already exists, update password if provided (for security)
        // But DO NOT update name - keep original central user name
        if ($centralUser->wasRecentlyCreated === false) {
            $centralUser->update([
                'password' => bcrypt($validated['admin_password']), // Update password for new tenant
            ]);
        }

        // Step 2: Store registration data in session for later tenant creation
        // This will be used after Stripe checkout success
        session(['pending_registration' => [
            'tenant_id' => $tenantId,
            'company_name' => $validated['company_name'],
            'domain' => $validated['domain'],
            'admin_name' => $validated['admin_name'],
            'admin_email' => $validated['admin_email'],
            'admin_password' => $validated['admin_password'],
            'plan_id' => $plan->id,
            'user_id' => $centralUser->id,
        ]]);

        // Check if this is a registration request
        // if (request()->routeIs('register.store')) {
        //     return redirect()->route('login')
        //         ->with('status', 'Registration successful! You can now log in to your account.');
        // }

        // For registration flow: log user in and redirect directly to Stripe checkout
        // Tenant will be created after Stripe checkout success
        if ($request->routeIs('register.store')) {
            // 1) Log the user in on the CENTRAL guard
            Auth::login($centralUser);
            Session::regenerate();
            session(['login_time' => now()->timestamp]);

            // 2) Create Stripe checkout session directly and redirect to Stripe
            try {
                // Set Stripe API key from Laravel config
                Stripe::setApiKey(config('cashier.secret'));

                // Create Stripe customer directly (without tenant)
                $stripeCustomer = \Stripe\Customer::create([
                    'email' => $centralUser->email,
                    'name' => $validated['admin_name'],
                    'metadata' => [
                        'pending_registration' => true,
                        'user_id' => $centralUser->id,
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
                Log::error('Stripe checkout session creation error during registration', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'plan_id' => $plan->id,
                    'stripe_secret_configured' => ! empty(config('cashier.secret')),
                ]);

                // Return JSON error response instead of redirecting
                return response()->json([
                    'error' => true,
                    'message' => config('app.debug')
                        ? 'Failed to create checkout session: '.$e->getMessage()
                        : 'Failed to create checkout session. Please try again.',
                ], 500);
            }
        }

        return redirect()->route('tenants.index')
            ->with('success', 'Tenant created successfully! Admin account has been setup.');
    }

    /**
     * Prepare registration data and redirect to Stripe payment link
     * This method validates registration data, generates encrypted token, and returns payment URL
     */
    public function prepare(Request $request)
    {
        // Validate registration data
        $request->merge([
            'domain' => $request->domain.'.'.config('tenancy.central_domains')[0],
        ]);

        $validated = $request->validate([
            'domain' => 'required|string|unique:domains,domain|max:255',
            'company_name' => 'required|string|max:255',
            'admin_name' => 'required|string|max:255',
            'admin_email' => [
                'required',
                'email',
                'max:255',
                function ($attribute, $value, $fail) {
                    // Check if email has been verified via OTP
                    $verification = \App\Models\EmailVerification::where('email', $value)
                        ->where('is_verified', true)
                        ->latest()
                        ->first();

                    if (! $verification) {
                        $fail('Email address has not been verified. Please complete the verification step.');

                        return;
                    }

                    // Check if verification is recent (within last 30 minutes)
                    if ($verification->verified_at->diffInMinutes(now()) > 30) {
                        $fail('Email verification has expired. Please start the registration process again.');

                        return;
                    }
                },
            ],
            'admin_password' => [
                'required',
                'confirmed',
                Password::min(8)
                    ->letters()
                    ->mixedCase()
                    ->numbers()
                    ->symbols(),
            ],
            'plan_id' => 'required|exists:subscription_plans,id',
        ]);

        // Auto-generate tenant ID from company_name
        $baseId = strtolower(str_replace(' ', '_', $validated['company_name']));
        $baseId = preg_replace('/[^a-z0-9_-]/', '', $baseId); // Remove invalid characters

        // Check for existing IDs and add suffix if needed
        $tenantId = $baseId;
        $counter = 1;
        $dbPrefix = config('tenancy.database.prefix', 'pms_');

        while (Tenant::where('id', $tenantId)->exists() || $this->databaseExists($dbPrefix.$tenantId)) {
            $tenantId = $baseId.'_'.$counter;
            $counter++;
        }

        // Get selected plan
        $plan = \App\Models\SubscriptionPlan::findOrFail($validated['plan_id']);

        // Validate plan has payment link configured
        if (empty($plan->stripe_payment_link)) {
            Log::error('Plan missing payment link', ['plan_id' => $plan->id]);

            return response()->json([
                'error' => true,
                'message' => 'Plan payment link not configured. Please contact support.',
            ], 500);
        }

        // Create encrypted registration token
        try {
            $token = RegistrationDataService::createRegistrationToken([
                'tenant_id' => $tenantId,
                'company_name' => $validated['company_name'],
                'domain' => $validated['domain'],
                'admin_name' => $validated['admin_name'],
                'admin_email' => $validated['admin_email'],
                'admin_password' => bcrypt($validated['admin_password']), // Hash password
                'plan_id' => $plan->id,
            ]);

            // Create pending registration record and store UUID in session
            $pendingRegistration = \App\Models\PendingRegistration::createPending(
                $token,
                $validated['admin_email']
            );

            // Store registration UUID in session for retrieval after Stripe redirect
            session([
                'registration_uuid' => $pendingRegistration->id,
                'registration_email' => $validated['admin_email'],
                'registration_tenant_id' => $tenantId,
            ]);

            // Build payment URL with registration UUID as client_reference_id query parameter
            // Using UUID instead of full token because:
            // 1. Token is 1180 characters (exceeds Stripe's 200 char limit)
            // 2. UUID is 36 characters (well within limit)
            // 3. Webhook will look up full token using UUID from database
            $paymentUrl = $plan->stripe_payment_link.'?client_reference_id='.urlencode($pendingRegistration->id);

            Log::info('Registration prepared, redirecting to Stripe Payment Link', [
                'tenant_id' => $tenantId,
                'plan_id' => $plan->id,
                'email' => $validated['admin_email'],
                'pending_registration_id' => $pendingRegistration->id,
                'registration_uuid_length' => strlen($pendingRegistration->id),
                'payment_url_base' => $plan->stripe_payment_link,
            ]);

            // Return payment URL for frontend redirect
            return response()->json([
                'payment_url' => $paymentUrl,
                'registration_uuid' => $pendingRegistration->id, // Also return for frontend use
            ]);
        } catch (\Exception $e) {
            Log::error('Registration preparation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => true,
                'message' => config('app.debug')
                    ? 'Failed to prepare registration: '.$e->getMessage()
                    : 'Failed to prepare registration. Please try again.',
            ], 500);
        }
    }

    /**
     * Check tenant creation status (for polling after Stripe payment)
     * Supports both Checkout Sessions (session_id) and Payment Links (registration_uuid)
     */
    public function checkStatus(Request $request)
    {
        $sessionId = $request->query('session_id');
        $registrationUuid = $request->query('registration_uuid') ?? session('registration_uuid');

        if (! $sessionId && ! $registrationUuid) {
            return response()->json([
                'status' => 'error',
                'message' => 'Missing session ID or registration UUID',
            ]);
        }

        try {
            $tenant = null;
            $userEmail = null;
            $registrationData = null;

            // Handle Checkout Session flow (has session_id)
            if ($sessionId) {
                // Set Stripe API key
                Stripe::setApiKey(config('cashier.secret'));

                // Retrieve Stripe session
                $session = \Stripe\Checkout\Session::retrieve($sessionId);
                $customerId = $session->customer;
                $userEmail = $session->customer_email;

                // Check if tenant exists (created by webhook)
                $tenant = Tenant::where('stripe_id', $customerId)->first();

                // Try to get registration data from session metadata
                if ($tenant && isset($session->metadata->registration_uuid)) {
                    $pendingRegistration = \App\Models\PendingRegistration::where('id', $session->metadata->registration_uuid)->first();
                    if ($pendingRegistration) {
                        $registrationData = RegistrationDataService::validateToken($pendingRegistration->encrypted_token);
                    }
                }
            }

            // Handle Payment Link flow (has registration_uuid)
            if ($registrationUuid && ! $tenant) {
                // Get registration data from pending registration
                $pendingRegistration = \App\Models\PendingRegistration::where('id', $registrationUuid)
                    ->where('expires_at', '>', now())
                    ->first();

                if (! $pendingRegistration) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Registration expired or not found',
                    ]);
                }

                // Decrypt registration data
                $registrationData = RegistrationDataService::validateToken($pendingRegistration->encrypted_token);

                if (! $registrationData) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Invalid registration data',
                    ]);
                }

                $userEmail = $registrationData['admin_email'];

                // Find tenant by tenant_id from registration data (webhook creates tenant with this ID)
                $tenant = Tenant::where('id', $registrationData['tenant_id'])->first();

                // If tenant not found by ID, try to find by email match
                // (webhook creates central user with this email and links to tenant)
                if (! $tenant) {
                    $centralUser = User::where('email', $userEmail)->first();
                    if ($centralUser) {
                        // Check if tenant was created and linked to user via tenant_user pivot
                        $tenantIds = DB::connection('central')
                            ->table('tenant_user')
                            ->where('user_id', $centralUser->id)
                            ->pluck('tenant_id');

                        if ($tenantIds->isNotEmpty()) {
                            // Get the most recently created tenant for this user
                            $tenant = Tenant::whereIn('id', $tenantIds)
                                ->orderBy('created_at', 'desc')
                                ->first();
                        }
                    }
                }
            }

            // If tenant exists, authenticate user and return success
            if ($tenant) {
                // Get user email from registration data or session
                if (! $userEmail && $registrationData) {
                    $userEmail = $registrationData['admin_email'];
                }

                if (! $userEmail) {
                    Log::error('Status check: Cannot determine user email', [
                        'session_id' => $sessionId,
                        'registration_uuid' => $registrationUuid,
                    ]);

                    return response()->json([
                        'status' => 'error',
                        'message' => 'Cannot determine user email',
                    ]);
                }

                // Find central user by email
                $user = User::where('email', $userEmail)->first();

                if (! $user) {
                    Log::error('Status check: User not found', [
                        'email' => $userEmail,
                        'tenant_id' => $tenant->id,
                    ]);

                    return response()->json([
                        'status' => 'error',
                        'message' => 'User not found',
                    ]);
                }

                // Authenticate user if not already authenticated
                if (! Auth::check()) {
                    Auth::login($user);
                    \Illuminate\Support\Facades\Session::regenerate();
                    session(['login_time' => now()->timestamp]);

                    Log::info('User authenticated after tenant creation', [
                        'user_id' => $user->id,
                        'email' => $userEmail,
                        'tenant_id' => $tenant->id,
                    ]);
                }

                // Clean up session data
                session()->forget(['registration_uuid', 'registration_email', 'registration_tenant_id']);

                // Clean up pending registration (mark as consumed)
                if ($registrationUuid) {
                    \App\Models\PendingRegistration::where('id', $registrationUuid)->delete();
                }

                return response()->json([
                    'status' => 'completed',
                    'redirect_url' => route('dashboard'),
                ]);
            }

            // Tenant not created yet, keep polling
            return response()->json(['status' => 'pending']);

        } catch (\Exception $e) {
            Log::error('Status check error', [
                'error' => $e->getMessage(),
                'session_id' => $sessionId,
                'registration_uuid' => $registrationUuid,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to check status',
            ]);
        }
    }

    /**
     * Run tenant setup (migrations, seeders, user creation)
     * Assumes tenant and domain already exist
     */
    public function runTenantSetup(Tenant $tenant, array $registrationData): void
    {
        Log::info('Starting tenant setup', [
            'tenant_id' => $tenant->id,
            'admin_email' => $registrationData['admin_email'],
        ]);

        try {
            // Get central user
            $centralUser = User::find($registrationData['user_id']);

            // Attach central user to tenant if not already attached
            if ($centralUser && ! $centralUser->tenants()->where('tenant_id', $tenant->id)->exists()) {
                $centralUser->tenants()->attach($tenant->id);
                Log::info('Attached central user to tenant', [
                    'user_id' => $centralUser->id,
                    'tenant_id' => $tenant->id,
                ]);
            }

            // Initialize tenant context
            tenancy()->initialize($tenant);

            Log::info('Running tenant migrations', ['tenant_id' => $tenant->id]);

            // Run migrations
            Artisan::call('tenants:migrate', [
                '--tenants' => [$tenant->id],
                '--force' => true,
            ]);

            Log::info('Creating tenant user', [
                'email' => $registrationData['admin_email'],
                'tenant_id' => $tenant->id,
            ]);

            // Create Keycloak user first
            $keycloakUserService = app(KeycloakUserService::class);
            $keycloakUserId = null;
            
            try {
                // Split name into first and last name
                $nameParts = explode(' ', $registrationData['admin_name'], 2);
                $firstName = $nameParts[0] ?? $registrationData['admin_name'];
                $lastName = $nameParts[1] ?? '';

                // Generate temporary password for Keycloak
                $temporaryPassword = Str::random(16);

                // Create user in Keycloak
                $keycloakUserId = $keycloakUserService->createUser(
                    $registrationData['admin_email'],
                    $firstName,
                    $lastName,
                    $temporaryPassword,
                    true // Email verified
                );

                if ($keycloakUserId) {
                    Log::info('Keycloak user created during tenant setup', [
                        'email' => $registrationData['admin_email'],
                        'keycloak_user_id' => $keycloakUserId,
                        'tenant_id' => $tenant->id,
                    ]);
                } else {
                    Log::warning('Failed to create Keycloak user, continuing with Laravel user creation', [
                        'email' => $registrationData['admin_email'],
                        'tenant_id' => $tenant->id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Exception creating Keycloak user during tenant setup', [
                    'email' => $registrationData['admin_email'],
                    'error' => $e->getMessage(),
                    'tenant_id' => $tenant->id,
                ]);
                // Continue with Laravel user creation even if Keycloak fails
            }

            // Create/update user in tenant database
            $tenantUser = User::updateOrCreate(
                ['email' => $registrationData['admin_email']],
                [
                    'name' => $registrationData['admin_name'],
                    'password' => bcrypt(Str::random(64)), // Random password since we use Keycloak
                    'email_verified_at' => now(),
                    'keycloak_user_id' => $keycloakUserId,
                ]
            );

            Log::info('Running roles and permissions seeder', ['tenant_id' => $tenant->id]);

            // Run seeders
            Artisan::call('db:seed', [
                '--class' => 'RolesAndPermissionSeederNewTenant',
                '--force' => true,
            ]);

            Artisan::call('db:seed', [
                '--class' => 'DefaultConsentSeeder',
                '--force' => true,
            ]);

            Log::info('Creating system wallet', ['tenant_id' => $tenant->id]);

            // Create clinic wallet
            $walletService = app(\App\Services\WalletService::class);
            $walletService->getSystemWallet();

            // Verify user has role
            $tenantUser->refresh();
            $roles = $tenantUser->getRoleNames()->toArray();
            Log::info('Tenant user roles after setup', [
                'user_id' => $tenantUser->id,
                'roles' => $roles,
                'has_admin' => $tenantUser->hasRole('Admin'),
            ]);

            tenancy()->end();

            Log::info('Tenant setup completed successfully', ['tenant_id' => $tenant->id]);

        } catch (\Exception $e) {
            tenancy()->end(); // Make sure to end tenancy on error

            Log::error('Tenant setup failed', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Create tenant with all necessary setup (migrations, seeders, user, etc.)
     * This is extracted to be reusable from BillingController after Stripe checkout
     */
    public function createTenantWithSetup(array $registrationData, string $stripeCustomerId): Tenant
    {
        $plan = \App\Models\SubscriptionPlan::findOrFail($registrationData['plan_id']);

        // Check if tenant already exists
        $tenant = Tenant::find($registrationData['tenant_id']);

        if ($tenant) {
            Log::info('Tenant already exists in createTenantWithSetup, running setup only', [
                'tenant_id' => $tenant->id,
            ]);

            // Run setup if not already done
            $this->runTenantSetup($tenant, $registrationData);

            // Send welcome email if needed
            try {
                Mail::to($registrationData['admin_email'])->send(
                    new TenantWelcomeMail(
                        $tenant,
                        $registrationData['admin_name'],
                        $registrationData['admin_email']
                    )
                );
                Log::info('Welcome email sent', [
                    'tenant_id' => $tenant->id,
                    'admin_email' => $registrationData['admin_email'],
                ]);
            } catch (\Exception $e) {
                Log::info('Failed to send welcome email: '.$e->getMessage());
            }

            return $tenant;
        }

        // Original creation logic for backward compatibility
        $tenant = Tenant::create([
            'id' => $registrationData['tenant_id'],
            'company_name' => $registrationData['company_name'] ?? $registrationData['tenant_id'],
            'is_onboarding' => 1,
            'subscription_plan_id' => $plan->id,
            'billing_status' => 'pending',
            'requires_billing_setup' => false,
            'is_onboarding_settings' => 1,
            'stripe_id' => $stripeCustomerId,
        ]);

        $tenant->domains()->create([
            'domain' => $registrationData['domain'],
        ]);

        // Create Stripe Connect account for marketplace functionality
        try {
            $stripeConnectService = app(\App\Services\StripeConnectService::class);
            $accountId = $stripeConnectService->createConnectedAccount($tenant);
            if ($accountId) {
                \Log::info('Stripe Connect account created for tenant', ['tenant_id' => $tenant->id]);
            } else {
                \Log::warning('Stripe Connect account creation returned null for tenant', ['tenant_id' => $tenant->id]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to create Stripe Connect account during tenant creation', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
            // Continue with tenant creation even if Stripe Connect fails
        }

        // Run setup using new method
        $this->runTenantSetup($tenant, $registrationData);

        // Send welcome email
        try {
            Mail::to($registrationData['admin_email'])->send(
                new TenantWelcomeMail(
                    $tenant,
                    $registrationData['admin_name'],
                    $registrationData['admin_email']
                )
            );
            Log::info('Welcome email sent', [
                'tenant_id' => $tenant->id,
                'admin_email' => $registrationData['admin_email'],
            ]);
        } catch (\Exception $e) {
            Log::info('Failed to send welcome email: '.$e->getMessage());
        }

        return $tenant;
    }

    public function redirectToTenant($tenant, $user)
    {
        $tenantSessionService = app(TenantSessionService::class);
        $url = $tenantSessionService->switchToTenant($user, $tenant);

        return Inertia::location($url);
    }

    /**
     * Extend trial period for a tenant
     * According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing#extending-trials
     */
    public function extendTrial(Request $request, Tenant $tenant)
    {
        $validated = $request->validate([
            'days' => 'required|integer|min:1|max:365',
        ]);

        try {
            StripeClient::setApiKey(config('cashier.secret'));

            $subscription = $tenant->subscription('default');

            // If no subscription exists but tenant is on trial, create one
            if (! $subscription) {
                // Get tenant's plan
                $plan = $tenant->subscriptionPlan;

                if (! $plan || ! $plan->stripe_price_id) {
                    return back()->withErrors(['error' => 'No subscription plan found for this tenant.']);
                }

                // Calculate trial end date
                $currentTrialEnd = $tenant->trial_ends_at;
                $newTrialEnd = $currentTrialEnd
                    ? $currentTrialEnd->copy()->addDays($validated['days'])
                    : now()->addDays($validated['days']);

                // Create subscription with trial period
                $subscription = $tenant->newSubscription('default', $plan->stripe_price_id)
                    ->trialUntil($newTrialEnd)
                    ->create();

                // Refresh subscription to get updated trial_ends_at from Stripe
                $subscription->refresh();

                // Sync trial_ends_at from subscription to tenant model
                // Cashier stores trial_ends_at on Subscription model, we need to sync it to Tenant
                $tenant->update([
                    'trial_ends_at' => $subscription->trial_ends_at,
                    'on_trial' => $subscription->onTrial(),
                    'billing_status' => 'trial',
                ]);

                Log::info('Trial created and extended for tenant', [
                    'tenant_id' => $tenant->id,
                    'days_added' => $validated['days'],
                    'new_trial_ends_at' => $subscription->trial_ends_at,
                ]);

                return redirect()->route('tenants.show', $tenant->id)
                    ->with('success', "Trial period extended by {$validated['days']} days successfully!");
            }

            // Calculate new trial end date
            // If subscription already has a trial_ends_at, extend from that date
            // Otherwise, start trial from now
            $currentTrialEnd = $subscription->trial_ends_at;
            $newTrialEnd = $currentTrialEnd
                ? $currentTrialEnd->copy()->addDays($validated['days'])
                : now()->addDays($validated['days']);

            // Extend trial using Cashier's extendTrial() method
            // According to Laravel Cashier docs: https://laravel.com/docs/12.x/billing#extending-trials
            // This method can extend trials even if they've expired
            $subscription->extendTrial($newTrialEnd);

            // Refresh subscription to get updated trial_ends_at from Stripe
            $subscription->refresh();

            // Sync trial_ends_at from subscription to tenant model
            // Cashier stores trial_ends_at on Subscription model, we need to sync it to Tenant
            $tenant->update([
                'trial_ends_at' => $subscription->trial_ends_at,
                'on_trial' => $subscription->onTrial(),
            ]);

            Log::info('Trial extended for tenant', [
                'tenant_id' => $tenant->id,
                'days_added' => $validated['days'],
                'new_trial_ends_at' => $subscription->trial_ends_at,
            ]);

            return redirect()->route('tenants.show', $tenant->id)
                ->with('success', "Trial period extended by {$validated['days']} days successfully!");
        } catch (\Exception $e) {
            Log::error('Failed to extend trial', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);

            return back()->withErrors(['error' => 'Failed to extend trial: '.$e->getMessage()]);
        }
    }

    public function destroy(Tenant $tenant)
    {
        $tenant->delete();

        return redirect()->route('tenants.index')->with('success', 'Tenant deleted!');
    }

    /**
     * Check if a database exists
     */
    protected function databaseExists(string $databaseName): bool
    {
        try {
            $connection = config('tenancy.database.central_connection', 'central');
            $databases = \DB::connection($connection)
                ->select('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [$databaseName]);

            return count($databases) > 0;
        } catch (\Exception $e) {
            \Log::warning('Error checking database existence', [
                'database' => $databaseName,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
