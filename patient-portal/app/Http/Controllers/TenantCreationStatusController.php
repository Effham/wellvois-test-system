<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class TenantCreationStatusController extends Controller
{
    /**
     * Show tenant creation status page
     */
    public function show(Request $request)
    {
        $tenantId = $request->query('tenant_id');
        $registrationUuid = $request->query('registration_uuid');

        if (! $tenantId && ! $registrationUuid) {
            return redirect()->route('register')->with('error', 'Invalid tenant creation status request.');
        }

        // If registration UUID provided, find tenant ID
        $registrationData = null;
        if ($registrationUuid && ! $tenantId) {
            $pendingRegistration = \App\Models\PendingRegistration::find($registrationUuid);
            if ($pendingRegistration) {
                $registrationData = \App\Services\RegistrationDataService::validateToken($pendingRegistration->encrypted_token);
                if ($registrationData) {
                    $tenantId = $registrationData['tenant_id'];
                }
            }
        }

        // Check if tenant exists and is complete
        $tenant = null;
        if ($tenantId) {
            $tenant = Tenant::find($tenantId);
            if ($tenant) {
                // Check if tenant creation is complete
                $isComplete = DB::table('tenant_user')
                    ->where('tenant_id', $tenantId)
                    ->where('is_tenant_creation_complete', true)
                    ->exists();

                if ($isComplete) {
                    // Tenant is complete, render with tenant data
                    return Inertia::render('Billing/TenantCreation', [
                        'tenant' => [
                            'id' => $tenant->id,
                            'name' => $tenant->company_name ?? $tenant->id,
                        ],
                        'sessionId' => null,
                        'registrationUuid' => $registrationUuid,
                        'email' => $registrationData['admin_email'] ?? null,
                        'polling' => false,
                    ]);
                }
            }
        }

        // Tenant not complete yet, show loading page
        return Inertia::render('Billing/TenantCreation', [
            'tenant' => null,
            'sessionId' => null,
            'registrationUuid' => $registrationUuid,
            'email' => $registrationData['admin_email'] ?? null,
            'polling' => true,
        ]);
    }

    /**
     * Check tenant creation status (API endpoint)
     */
    public function checkStatus(Request $request)
    {
        $tenantId = $request->query('tenant_id');
        $registrationUuid = $request->query('registration_uuid');

        Log::info('[TENANT_CREATION_STATUS] Checking status', [
            'tenant_id' => $tenantId,
            'registration_uuid' => $registrationUuid,
            'current_domain' => $request->getHost(),
        ]);

        if (! $tenantId && ! $registrationUuid) {
            return response()->json([
                'is_complete' => false,
                'tenant_id' => null,
                'error' => 'Missing tenant_id or registration_uuid',
            ], 400);
        }

        // If registration UUID provided, find tenant ID
        $registrationData = null;
        if ($registrationUuid && ! $tenantId) {
            $pendingRegistration = \App\Models\PendingRegistration::find($registrationUuid);
            if ($pendingRegistration) {
                $registrationData = \App\Services\RegistrationDataService::validateToken($pendingRegistration->encrypted_token);
                if ($registrationData) {
                    $tenantId = $registrationData['tenant_id'];
                    Log::info('[TENANT_CREATION_STATUS] Found tenant_id from registration', [
                        'tenant_id' => $tenantId,
                        'email' => $registrationData['admin_email'] ?? null,
                    ]);
                }
            }
        }

        if (! $tenantId) {
            Log::warning('[TENANT_CREATION_STATUS] Tenant ID not found', [
                'registration_uuid' => $registrationUuid,
            ]);

            return response()->json([
                'is_complete' => false,
                'tenant_id' => null,
                'error' => 'Tenant not found',
            ]);
        }

        // Check if tenant exists
        $tenant = Tenant::find($tenantId);

        if (! $tenant) {
            Log::info('[TENANT_CREATION_STATUS] Tenant does not exist yet', [
                'tenant_id' => $tenantId,
            ]);

            return response()->json([
                'is_complete' => false,
                'tenant_id' => $tenantId,
                'error' => 'Tenant does not exist yet',
            ]);
        }

        // Get tenant domain for logging
        $tenantDomain = $tenant->domains->first()->domain ?? 'unknown';
        Log::info('[TENANT_CREATION_STATUS] Tenant exists', [
            'tenant_id' => $tenantId,
            'tenant_domain' => $tenantDomain,
            'expected_url' => "http://{$tenantDomain}:8000/onboarding",
        ]);

        // Check completion status from tenant_user table (central DB)
        // No tenant context needed - we're querying the central database
        $isComplete = DB::table('tenant_user')
            ->where('tenant_id', $tenantId)
            ->where('is_tenant_creation_complete', true)
            ->exists();

        Log::info('[TENANT_CREATION_STATUS] Completion status', [
            'tenant_id' => $tenantId,
            'is_complete' => $isComplete,
        ]);

        return response()->json([
            'is_complete' => $isComplete,
            'tenant_id' => $tenantId,
        ]);
    }

    /**
     * Redirect to tenant domain via SSO after tenant creation completes
     */
    public function redirect(Request $request)
    {
        $tenantId = $request->query('tenant_id');
        $registrationUuid = $request->query('registration_uuid');

        Log::info('[TENANT_CREATION_REDIRECT] Starting redirect', [
            'tenant_id' => $tenantId,
            'registration_uuid' => $registrationUuid,
        ]);

        if (! $tenantId && ! $registrationUuid) {
            Log::error('[TENANT_CREATION_REDIRECT] Missing parameters');

            return redirect()->route('register')->with('error', 'Invalid redirect request.');
        }

        // Get registration data to find user email
        $registrationData = null;
        if ($registrationUuid) {
            $pendingRegistration = \App\Models\PendingRegistration::find($registrationUuid);
            if ($pendingRegistration) {
                $registrationData = \App\Services\RegistrationDataService::validateToken($pendingRegistration->encrypted_token);
                if ($registrationData && ! $tenantId) {
                    $tenantId = $registrationData['tenant_id'];
                }
            }
        }

        if (! $tenantId) {
            Log::error('[TENANT_CREATION_REDIRECT] Tenant ID not found');

            return redirect()->route('register')->with('error', 'Tenant not found.');
        }

        // Find tenant
        $tenant = Tenant::find($tenantId);
        if (! $tenant) {
            Log::error('[TENANT_CREATION_REDIRECT] Tenant does not exist', ['tenant_id' => $tenantId]);

            return redirect()->route('register')->with('error', 'Tenant not found.');
        }

        // Get user email from registration data
        $userEmail = $registrationData['admin_email'] ?? null;
        if (! $userEmail) {
            Log::error('[TENANT_CREATION_REDIRECT] User email not found in registration data');

            return redirect()->route('register')->with('error', 'User email not found.');
        }

        // Find user by email
        $user = \App\Models\User::where('email', $userEmail)->first();
        if (! $user) {
            Log::error('[TENANT_CREATION_REDIRECT] User not found', ['email' => $userEmail]);

            return redirect()->route('register')->with('error', 'User account not found. Please contact support.');
        }

        Log::info('[TENANT_CREATION_REDIRECT] User found', [
            'user_id' => $user->id,
            'email' => $userEmail,
            'tenant_id' => $tenantId,
        ]);

        // Authenticate user if not already authenticated
        if (! Auth::check() || Auth::id() !== $user->id) {
            try {
                Auth::login($user);
                Session::regenerate();
                session(['login_time' => now()->timestamp]);

                Log::info('[TENANT_CREATION_REDIRECT] User authenticated', [
                    'user_id' => $user->id,
                ]);
            } catch (\Exception $e) {
                Log::error('[TENANT_CREATION_REDIRECT] Failed to authenticate user', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                return redirect()->route('register')->with('error', 'Authentication failed. Please try logging in manually.');
            }
        }

        // Verify tenant_user relationship exists (with retry logic)
        $maxRetries = 5;
        $retryDelay = 0.5; // 500ms
        $relationshipExists = false;

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            $user->refresh();

            // Check relationship via Eloquent
            $relationshipExists = $user->tenants()->where('tenant_id', $tenant->id)->exists();

            // If not found, try direct DB query (handles race conditions)
            if (! $relationshipExists) {
                $relationshipExists = DB::table('tenant_user')
                    ->where('user_id', $user->id)
                    ->where('tenant_id', $tenant->id)
                    ->exists();
            }

            if ($relationshipExists) {
                Log::info('[TENANT_CREATION_REDIRECT] Tenant-user relationship verified', [
                    'user_id' => $user->id,
                    'tenant_id' => $tenant->id,
                    'attempt' => $attempt,
                ]);
                break;
            }

            if ($attempt < $maxRetries) {
                Log::warning('[TENANT_CREATION_REDIRECT] Tenant-user relationship not found, retrying', [
                    'user_id' => $user->id,
                    'tenant_id' => $tenant->id,
                    'attempt' => $attempt,
                ]);
                usleep($retryDelay * 1000000); // Convert to microseconds
            }
        }

        if (! $relationshipExists) {
            Log::error('[TENANT_CREATION_REDIRECT] Tenant-user relationship not found after retries', [
                'user_id' => $user->id,
                'tenant_id' => $tenant->id,
            ]);

            return redirect()->route('register')->with('error', 'Account setup incomplete. Please contact support.');
        }

        // Clean up session data
        session()->forget(['registration_uuid', 'registration_email', 'registration_tenant_id']);

        // Clean up pending registration
        if ($registrationUuid) {
            try {
                $pendingRegistration = \App\Models\PendingRegistration::find($registrationUuid);
                if ($pendingRegistration) {
                    $pendingRegistration->delete();
                    Log::info('[TENANT_CREATION_REDIRECT] Pending registration cleaned up', [
                        'registration_uuid' => $registrationUuid,
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('[TENANT_CREATION_REDIRECT] Failed to delete pending registration', [
                    'registration_uuid' => $registrationUuid,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Redirect to tenant domain via SSO
        try {
            $authController = app(\App\Http\Controllers\Auth\AuthenticatedSessionController::class);
            $redirectUrl = $authController->redirectToTenantWithRedirect($tenant, $user, '/onboarding');

            Log::info('[TENANT_CREATION_REDIRECT] Redirecting to tenant via SSO', [
                'tenant_id' => $tenant->id,
                'tenant_domain' => $tenant->domains->first()->domain ?? 'unknown',
                'redirect_path' => '/onboarding',
            ]);

            return $redirectUrl;
        } catch (\Exception $e) {
            Log::error('[TENANT_CREATION_REDIRECT] Failed to redirect to tenant', [
                'user_id' => $user->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Fallback redirect
            return redirect()->route('tenant.selection')->with('success', 'Registration completed successfully!');
        }
    }
}
