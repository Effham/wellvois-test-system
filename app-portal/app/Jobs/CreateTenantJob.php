<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Models\User;
use App\Services\KeycloakUserService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CreateTenantJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public array $registrationData,
        public string $customerId,
        public ?string $subscriptionId = null,
        public ?string $paymentIntentId = null,
        public ?string $sessionId = null,
        public int $quantity = 1,
        public float $amount = 0.0,
        public string $currency = 'usd',
        public ?int $trialEnd = null,
        public ?string $registrationUuid = null
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('[CREATE_TENANT_JOB] Starting tenant creation job', [
            'tenant_id' => $this->registrationData['tenant_id'],
            'admin_email' => $this->registrationData['admin_email'],
            'customer_id' => $this->customerId,
        ]);

        try {
            // Step 1: Check if tenant already exists (idempotency)
            $tenant = Tenant::find($this->registrationData['tenant_id']);

            if ($tenant) {
                Log::info('[CREATE_TENANT_JOB] Tenant already exists, checking setup status', [
                    'tenant_id' => $tenant->id,
                ]);

                // Check if setup is complete
                tenancy()->initialize($tenant);
                $hasRoles = \Spatie\Permission\Models\Role::exists();
                tenancy()->end();

                if ($hasRoles) {
                    Log::info('[CREATE_TENANT_JOB] Tenant setup already complete, marking as complete', [
                        'tenant_id' => $tenant->id,
                    ]);

                    // Get or create central user and attach to tenant
                    // Check if Keycloak user needs to be created
                    $keycloakUserService = app(KeycloakUserService::class);
                    $keycloakUserId = null;
                    
                    // Check if user exists and has Keycloak user ID
                    $existingCentralUser = tenancy()->central(function () {
                        return User::where('email', $this->registrationData['admin_email'])->first();
                    });
                    
                    if ($existingCentralUser && !$existingCentralUser->keycloak_user_id) {
                        // User exists but doesn't have Keycloak user ID, create one
                        try {
                            $nameParts = explode(' ', $this->registrationData['admin_name'], 2);
                            $firstName = $nameParts[0] ?? $this->registrationData['admin_name'];
                            $lastName = $nameParts[1] ?? '';
                            
                            // Use the password from registration data (should be plain text)
                            $adminPassword = $this->registrationData['admin_password'] ?? null;
                            
                            $keycloakUserId = $keycloakUserService->createUser(
                                $this->registrationData['admin_email'],
                                $firstName,
                                $lastName,
                                $adminPassword,
                                false // Not temporary - user can use this password directly
                            );
                            
                            if ($keycloakUserId) {
                                tenancy()->central(function () use ($existingCentralUser, $keycloakUserId) {
                                    $existingCentralUser->keycloak_user_id = $keycloakUserId;
                                    $existingCentralUser->save();
                                });
                                Log::info('[CREATE_TENANT_JOB] Created Keycloak user for existing central user', [
                                    'email' => $this->registrationData['admin_email'],
                                    'keycloak_user_id' => $keycloakUserId,
                                ]);
                            }
                        } catch (\Exception $e) {
                            Log::error('[CREATE_TENANT_JOB] Exception creating Keycloak user for existing user', [
                                'email' => $this->registrationData['admin_email'],
                                'error' => $e->getMessage(),
                            ]);
                        }
                    } else if ($existingCentralUser) {
                        $keycloakUserId = $existingCentralUser->keycloak_user_id;
                    }
                    
                    $centralUser = tenancy()->central(function () use ($keycloakUserId) {
                        // Hash the password for Laravel storage (from registration data)
                        $hashedPassword = isset($this->registrationData['admin_password']) 
                            ? bcrypt($this->registrationData['admin_password'])
                            : bcrypt(Str::random(64));
                        
                        return User::firstOrCreate(
                            ['email' => $this->registrationData['admin_email']],
                            [
                                'name' => $this->registrationData['admin_name'],
                                'password' => $hashedPassword,
                                'email_verified_at' => now(),
                                'keycloak_user_id' => $keycloakUserId,
                            ]
                        );
                    });

                    // Attach user to tenant if not already attached and set completion flag
                    tenancy()->central(function () use ($centralUser, $tenant) {
                        if ($centralUser && ! $centralUser->tenants()->where('tenant_id', $tenant->id)->exists()) {
                            $centralUser->tenants()->attach($tenant->id);
                            Log::info('[CREATE_TENANT_JOB] Attached central user to tenant (idempotency check)', [
                                'user_id' => $centralUser->id,
                                'tenant_id' => $tenant->id,
                            ]);
                        }

                        // Ensure tenant_user record exists and set completion flag to true
                        if ($centralUser) {
                            $updated = DB::table('tenant_user')
                                ->where('tenant_id', $tenant->id)
                                ->where('user_id', $centralUser->id)
                                ->update(['is_tenant_creation_complete' => true]);

                            if ($updated === 0) {
                                // Create record if it doesn't exist (edge case)
                                DB::table('tenant_user')->insert([
                                    'user_id' => $centralUser->id,
                                    'tenant_id' => $tenant->id,
                                    'is_tenant_creation_complete' => true,
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]);
                            }

                            Log::info('[CREATE_TENANT_JOB] Set is_tenant_creation_complete to true (tenant already complete)', [
                                'user_id' => $centralUser->id,
                                'tenant_id' => $tenant->id,
                            ]);
                        }
                    });

                    return;
                }

                Log::info('[CREATE_TENANT_JOB] Tenant exists but setup incomplete, continuing setup', [
                    'tenant_id' => $tenant->id,
                ]);
            } else {
                // Step 2: Create tenant record
                Log::info('[CREATE_TENANT_JOB] Creating tenant record', [
                    'tenant_id' => $this->registrationData['tenant_id'],
                    'company_name' => $this->registrationData['company_name'] ?? null,
                    'stripe_customer_id' => $this->customerId,
                    'subscription_id' => $this->subscriptionId,
                ]);

                $tenant = Tenant::create([
                    'id' => $this->registrationData['tenant_id'],
                    'company_name' => $this->registrationData['company_name'],
                    'subscription_plan_id' => $this->registrationData['plan_id'],
                    'stripe_id' => $this->customerId,
                    'stripe_payment_intent_id' => $this->paymentIntentId,
                    'number_of_seats' => $this->quantity,
                    'total_amount_paid' => $this->amount,
                    'payment_currency' => $this->currency,
                    'payment_metadata' => [
                        'session_id' => $this->sessionId,
                        'subscription_id' => $this->subscriptionId,
                        'payment_intent_id' => $this->paymentIntentId,
                        'registration_uuid' => $this->registrationUuid,
                        'created_at' => now()->toDateTimeString(),
                    ],
                    'billing_status' => 'active',
                    'requires_billing_setup' => false,
                    'billing_completed_at' => now(),
                    'on_trial' => $this->trialEnd ? true : false,
                    'trial_ends_at' => $this->trialEnd ? Carbon::createFromTimestamp($this->trialEnd) : null,
                    'subscribed_at' => now(),
                ]);

                Log::info('[CREATE_TENANT_JOB] Tenant created successfully', [
                    'tenant_id' => $tenant->id,
                    'billing_status' => $tenant->billing_status,
                    'stripe_id' => $tenant->stripe_id,
                ]);

                // Step 3: Create domain
                Log::info('[CREATE_TENANT_JOB] Creating tenant domain', [
                    'tenant_id' => $tenant->id,
                    'domain' => $this->registrationData['domain'],
                ]);

                $tenant->domains()->create([
                    'domain' => $this->registrationData['domain'],
                ]);

                Log::info('[CREATE_TENANT_JOB] Domain created successfully', [
                    'tenant_id' => $tenant->id,
                    'domain' => $this->registrationData['domain'],
                ]);
            }

            // Step 4: Initialize tenant context
            tenancy()->initialize($tenant);

            Log::info('[CREATE_TENANT_JOB] Running tenant migrations', [
                'tenant_id' => $tenant->id,
            ]);

            // Step 6: Run migrations
            Artisan::call('tenants:migrate', [
                '--tenants' => [$tenant->id],
                '--force' => true,
            ]);

            Log::info('[CREATE_TENANT_JOB] Migrations completed', [
                'tenant_id' => $tenant->id,
            ]);

            // Verify migrations completed successfully by checking if users table exists
            $usersTableExists = DB::getSchemaBuilder()->hasTable('users');
            if (! $usersTableExists) {
                throw new \Exception('Users table does not exist after migrations');
            }

            // Check if deleted_at column exists (migration may have run)
            $hasDeletedAtColumn = DB::getSchemaBuilder()->hasColumn('users', 'deleted_at');
            Log::info('[CREATE_TENANT_JOB] Users table structure check', [
                'tenant_id' => $tenant->id,
                'users_table_exists' => $usersTableExists,
                'deleted_at_column_exists' => $hasDeletedAtColumn,
            ]);

            // Step 7: Get or create central user (must use tenancy()->central() since we're in tenant context)
            // Create Keycloak user first for central user
            $keycloakUserService = app(KeycloakUserService::class);
            $keycloakUserId = null;
            
            try {
                // Split name into first and last name
                $nameParts = explode(' ', $this->registrationData['admin_name'], 2);
                $firstName = $nameParts[0] ?? $this->registrationData['admin_name'];
                $lastName = $nameParts[1] ?? '';

                // Use the password from registration data (should be plain text)
                // The password is stored as plain text in the encrypted registration token
                $adminPassword = $this->registrationData['admin_password'] ?? null;
                
                if (!$adminPassword) {
                    Log::warning('[CREATE_TENANT_JOB] No password provided, creating Keycloak user without password', [
                        'email' => $this->registrationData['admin_email'],
                    ]);
                    $adminPassword = null;
                }

                // Create user in Keycloak with the provided password
                $keycloakUserId = $keycloakUserService->createUser(
                    $this->registrationData['admin_email'],
                    $firstName,
                    $lastName,
                    $adminPassword,
                    false // Not temporary - user can use this password directly
                );

                if ($keycloakUserId) {
                    Log::info('[CREATE_TENANT_JOB] Keycloak user created for central user', [
                        'email' => $this->registrationData['admin_email'],
                        'keycloak_user_id' => $keycloakUserId,
                    ]);
                } else {
                    Log::warning('[CREATE_TENANT_JOB] Failed to create Keycloak user, continuing with Laravel user creation', [
                        'email' => $this->registrationData['admin_email'],
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('[CREATE_TENANT_JOB] Exception creating Keycloak user', [
                    'email' => $this->registrationData['admin_email'],
                    'error' => $e->getMessage(),
                ]);
                // Continue with Laravel user creation even if Keycloak fails
            }

            $centralUser = tenancy()->central(function () use ($keycloakUserId) {
                return User::firstOrCreate(
                    ['email' => $this->registrationData['admin_email']],
                    [
                        'name' => $this->registrationData['admin_name'],
                        'password' => bcrypt(Str::random(64)), // Random password since we use Keycloak
                        'email_verified_at' => now(),
                        'keycloak_user_id' => $keycloakUserId,
                    ]
                );
            });

            // Update keycloak_user_id if user already existed but didn't have it
            if ($centralUser && !$centralUser->keycloak_user_id && $keycloakUserId) {
                tenancy()->central(function () use ($centralUser, $keycloakUserId) {
                    $centralUser->keycloak_user_id = $keycloakUserId;
                    $centralUser->save();
                });
            }

            // Attach central user to tenant if not already attached
            tenancy()->central(function () use ($centralUser, $tenant) {
                $wasAttached = $centralUser && $centralUser->tenants()->where('tenant_id', $tenant->id)->exists();

                if ($centralUser && ! $wasAttached) {
                    $centralUser->tenants()->attach($tenant->id);
                    Log::info('[CREATE_TENANT_JOB] Attached central user to tenant', [
                        'user_id' => $centralUser->id,
                        'tenant_id' => $tenant->id,
                    ]);
                }

                // ALWAYS set is_tenant_creation_complete to false at start of tenant creation
                // This ensures we reset the flag even if user was already attached
                if ($centralUser) {
                    $updated = DB::table('tenant_user')
                        ->where('tenant_id', $tenant->id)
                        ->where('user_id', $centralUser->id)
                        ->update(['is_tenant_creation_complete' => false]);

                    if ($updated === 0) {
                        // If no record exists, create it (shouldn't happen, but handle edge case)
                        Log::warning('[CREATE_TENANT_JOB] tenant_user record not found, creating it', [
                            'user_id' => $centralUser->id,
                            'tenant_id' => $tenant->id,
                        ]);
                        DB::table('tenant_user')->insert([
                            'user_id' => $centralUser->id,
                            'tenant_id' => $tenant->id,
                            'is_tenant_creation_complete' => false,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }

                    Log::info('[CREATE_TENANT_JOB] Set is_tenant_creation_complete to false at start', [
                        'user_id' => $centralUser->id,
                        'tenant_id' => $tenant->id,
                        'was_already_attached' => $wasAttached,
                    ]);
                }
            });

            Log::info('[CREATE_TENANT_JOB] Creating tenant user', [
                'email' => $this->registrationData['admin_email'],
                'tenant_id' => $tenant->id,
            ]);

            // Step 8: Create tenant user
            // Use DB facade to avoid SoftDeletes issues if deleted_at column doesn't exist yet
            try {
                // Check if user exists first
                $existingTenantUser = DB::table('users')
                    ->where('email', $this->registrationData['admin_email'])
                    ->first();

                if ($existingTenantUser) {
                    // Update existing user
                    DB::table('users')
                        ->where('id', $existingTenantUser->id)
                        ->update([
                            'name' => $this->registrationData['admin_name'],
                            'password' => bcrypt(Str::random(64)), // Random password since we use Keycloak
                            'email_verified_at' => now(),
                            'updated_at' => now(),
                        ]);
                    // Use withoutGlobalScopes to bypass SoftDeletes if deleted_at column doesn't exist
                    $tenantUser = User::withoutGlobalScopes()->find($existingTenantUser->id);

                    Log::info('[CREATE_TENANT_JOB] Tenant user updated', [
                        'user_id' => $tenantUser->id,
                        'email' => $this->registrationData['admin_email'],
                    ]);
                } else {
                    // Create new tenant user
                    // Note: keycloak_user_id is stored in central database, not tenant database
                    $userId = DB::table('users')->insertGetId([
                        'name' => $this->registrationData['admin_name'],
                        'email' => $this->registrationData['admin_email'],
                        'password' => bcrypt(Str::random(64)), // Random password since we use Keycloak
                        'email_verified_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    // Use withoutGlobalScopes to bypass SoftDeletes if deleted_at column doesn't exist
                    $tenantUser = User::withoutGlobalScopes()->find($userId);

                    Log::info('[CREATE_TENANT_JOB] Tenant user created', [
                        'user_id' => $tenantUser->id,
                        'email' => $this->registrationData['admin_email'],
                        'keycloak_user_id' => $keycloakUserId,
                    ]);
                }

                if (! $tenantUser) {
                    throw new \Exception('Failed to retrieve tenant user after creation');
                }
            } catch (\Exception $e) {
                Log::error('[CREATE_TENANT_JOB] Failed to create tenant user', [
                    'tenant_id' => $tenant->id,
                    'email' => $this->registrationData['admin_email'],
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                throw $e;
            }

            Log::info('[CREATE_TENANT_JOB] Running roles and permissions seeder', [
                'tenant_id' => $tenant->id,
            ]);

            // Step 9: Run seeders
            Artisan::call('db:seed', [
                '--class' => 'RolesAndPermissionSeederNewTenant',
                '--force' => true,
            ]);

            Artisan::call('db:seed', [
                '--class' => 'DefaultConsentSeeder',
                '--force' => true,
            ]);

            Log::info('[CREATE_TENANT_JOB] Creating system wallet', [
                'tenant_id' => $tenant->id,
            ]);

            // Create clinic wallet
            $walletService = app(\App\Services\WalletService::class);
            $walletService->getSystemWallet();

            // Verify user has role
            // Use withoutGlobalScopes to bypass SoftDeletes when refreshing user
            // Refresh by re-fetching to avoid SoftDeletes scope issues
            $tenantUser = User::withoutGlobalScopes()->find($tenantUser->id);
            $roles = $tenantUser->getRoleNames()->toArray();
            Log::info('[CREATE_TENANT_JOB] Tenant user roles after setup', [
                'user_id' => $tenantUser->id,
                'roles' => $roles,
                'has_admin' => $tenantUser->hasRole('Admin'),
            ]);

            // Step 10: Create Stripe Connect account
            Log::info('[CREATE_TENANT_JOB] Creating Stripe Connect account', [
                'tenant_id' => $tenant->id,
            ]);

            try {
                $stripeConnectService = app(\App\Services\StripeConnectService::class);
                $accountId = $stripeConnectService->createConnectedAccount($tenant);
                if ($accountId) {
                    Log::info('[CREATE_TENANT_JOB] Stripe Connect account created', [
                        'tenant_id' => $tenant->id,
                        'account_id' => $accountId,
                    ]);
                } else {
                    Log::warning('[CREATE_TENANT_JOB] Stripe Connect account creation returned null', [
                        'tenant_id' => $tenant->id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('[CREATE_TENANT_JOB] Failed to create Stripe Connect account', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                ]);
                // Continue even if Stripe Connect fails
            }

            // Step 11: Create licenses based on number_of_seats
            Log::info('[CREATE_TENANT_JOB] Creating licenses for tenant', [
                'tenant_id' => $tenant->id,
                'number_of_seats' => $this->quantity,
            ]);

            try {
                $licenseService = new \App\Services\LicenseService;
                $licenseService->createLicensesForTenantSeats($tenant);
                Log::info('[CREATE_TENANT_JOB] Licenses created successfully', [
                    'tenant_id' => $tenant->id,
                ]);
            } catch (\Exception $e) {
                Log::error('[CREATE_TENANT_JOB] Failed to create licenses', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                ]);
                // Continue even if license creation fails
            }

            // Step 12: Set is_tenant_creation_complete to true in tenant_user table (central DB)
            // No tenant context needed - we're updating the central database
            tenancy()->central(function () use ($tenant, $centralUser) {
                $updated = DB::table('tenant_user')
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $centralUser->id)
                    ->update(['is_tenant_creation_complete' => true]);

                if ($updated === 0) {
                    // Edge case: tenant_user record doesn't exist (shouldn't happen, but handle it)
                    Log::warning('[CREATE_TENANT_JOB] tenant_user record not found when setting completion, creating it', [
                        'user_id' => $centralUser->id,
                        'tenant_id' => $tenant->id,
                    ]);
                    DB::table('tenant_user')->insert([
                        'user_id' => $centralUser->id,
                        'tenant_id' => $tenant->id,
                        'is_tenant_creation_complete' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                Log::info('[CREATE_TENANT_JOB] Tenant creation completed successfully', [
                    'tenant_id' => $tenant->id,
                    'user_id' => $centralUser->id,
                    'is_tenant_creation_complete' => true,
                ]);
            });

            // End tenant context
            if (tenancy()->initialized) {
                tenancy()->end();
            }

        } catch (\Exception $e) {
            // Make sure to end tenancy on error
            if (tenancy()->initialized) {
                tenancy()->end();
            }

            Log::error('[CREATE_TENANT_JOB] Tenant creation failed', [
                'tenant_id' => $this->registrationData['tenant_id'] ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't throw - allows job to be retried
            // The error is logged for debugging
        }
    }
}
