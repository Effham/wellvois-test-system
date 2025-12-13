<?php

namespace App\Http\Controllers;

use App\Models\Practitioner;
use App\Models\PractitionerInvitation;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class PractitionerInvitationController extends Controller
{
    public function show($token)
    {
        $invitation = PractitionerInvitation::where('token', $token)
            ->with(['practitioner', 'tenant'])
            ->firstOrFail();

        // Check if invitation is valid
        if ($invitation->status !== 'pending' || $invitation->isExpired()) {
            return Inertia::render('auth/invitation-expired', [
                'message' => $invitation->isExpired()
                    ? 'This invitation has expired.'
                    : 'This invitation is no longer valid.',
            ]);
        }

        // Check if this is an email-only invitation (new self-registration flow)
        if ($invitation->isEmailOnlyInvitation()) {
            // Fetch practitioner consents from the tenant database
            $consents = [];
            try {
                tenancy()->initialize($invitation->tenant);

                $consents = \App\Models\Tenant\Consent::where('entity_type', 'PRACTITIONER')
                    ->where('is_required', true)
                    ->with('activeVersion')
                    ->get()
                    ->map(function ($consent) {
                        return [
                            'id' => $consent->id,
                            'title' => $consent->title,
                            'key' => $consent->key,
                            'is_required' => $consent->is_required,
                            'consent_body' => $consent->activeVersion ? $consent->activeVersion->consent_body : null,
                        ];
                    });

                tenancy()->end();
            } catch (\Exception $e) {
                Log::error('Failed to fetch practitioner consents for self-registration', [
                    'tenant_id' => $invitation->tenant_id,
                    'error' => $e->getMessage(),
                ]);
                tenancy()->end();
            }

            // Check if a practitioner with this email already exists
            $existingPractitioner = null;
            tenancy()->central(function () use (&$existingPractitioner, $invitation) {
                Log::info('Finding practitioner by email', [
                    'email' => $invitation->email,
                ]);
                $userId = User::where('email', $invitation->email)->value('id'); // null if not found
                if (! $userId) {

                    $existingPractitioner = null;
                } else {
                    $existingPractitioner = Practitioner::where('user_id', $userId)
                        ->first();
                    Log::info('PRAC ID', [
                        'email' => $invitation->email,
                        'user_id' => $userId,
                        'practitioner_exists' => $existingPractitioner !== null,
                        'practitioner_user_id' => $existingPractitioner?->user_id,
                    ]);
                }

                // $existingPractitioner = Practitioner::where('email', $invitation->email)->first();
            });

            return Inertia::render('auth/practitioner-self-registration', [
                'invitation' => $invitation,
                'tenant' => $invitation->tenant,
                'token' => $token,
                'consents' => $consents,
                'existingPractitioner' => $existingPractitioner,
            ]);
        }

        // Old flow: practitioner already exists
        // Check if practitioner already has a user account
        $requiresRegistration = $invitation->practitioner->user_id === null;

        return Inertia::render('auth/practitioner-invitation', [
            'invitation' => $invitation,
            'practitioner' => $invitation->practitioner,
            'tenant' => $invitation->tenant,
            'token' => $token,
            'requiresRegistration' => $requiresRegistration,
        ]);
    }

    public function accept(Request $request, $token)
    {
        Log::info('=== PractitionerInvitation Accept Started ===', [
            'token' => $token,
            'request_all' => $request->all(),
            'request_method' => $request->method(),
            'has_password' => $request->has('password'),
            'has_terms' => $request->has('terms'),
            'has_administrative_consent' => $request->has('administrative_consent'),
            'administrative_consent_value' => $request->input('administrative_consent'),
        ]);

        $invitation = PractitionerInvitation::where('token', $token)
            ->with(['practitioner', 'tenant'])
            ->firstOrFail();

        Log::info('Invitation found', [
            'invitation_id' => $invitation->id,
            'status' => $invitation->status,
            'practitioner_id' => $invitation->practitioner_id,
            'has_user_id' => (bool) $invitation->practitioner->user_id,
        ]);

        // Check if invitation is valid
        if ($invitation->status !== 'pending' || $invitation->isExpired()) {
            Log::warning('Invitation invalid or expired');

            return back()->withErrors(['invitation' => 'This invitation is no longer valid or has expired.']);
        }

        // Scenario 1: Practitioner already has user account - just accept invitation to join tenant
        if ($invitation->practitioner->user_id) {
            Log::info('Routing to EXISTING USER flow');

            return $this->acceptExistingUser($request, $invitation);
        }

        // Scenario 2: First-time practitioner - needs to set password and register
        Log::info('Routing to NEW USER flow');

        return $this->registerAndAccept($request, $invitation);
    }

    protected function acceptExistingUser(Request $request, PractitionerInvitation $invitation)
    {
        Log::info('=== acceptExistingUser Started ===', [
            'invitation_id' => $invitation->id,
            'practitioner_id' => $invitation->practitioner_id,
            'request_data' => $request->all(),
        ]);

        // Validate terms and administrative consent
        try {
            $validated = $request->validate([
                'terms' => 'accepted',
                'administrative_consent' => 'required|accepted',
            ]);

            Log::info('Validation passed for existing user', [
                'validated' => $validated,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed for existing user', [
                'errors' => $e->errors(),
                'request_data' => $request->all(),
            ]);
            throw $e;
        }

        // Find the user
        $user = User::find($invitation->practitioner->user_id);

        Log::info('User found', [
            'user_id' => $user ? $user->id : null,
            'user_email' => $user ? $user->email : null,
        ]);

        if (! $user) {
            return back()->withErrors(['user' => 'User account not found.']);
        }

        try {
            // Accept the invitation
            $invitation->accept();

            // Update tenant-practitioner relationship status to ACCEPTED and ensure tenant_user entry
            tenancy()->central(function () use ($invitation, $user) {
                DB::table('tenant_practitioners')
                    ->where('tenant_id', $invitation->tenant_id)
                    ->where('practitioner_id', $invitation->practitioner_id)
                    ->update([
                        'invitation_status' => 'ACCEPTED',
                        'updated_at' => now(),
                    ]);

                // Create tenant_user relationship if it doesn't exist
                $existingTenantUser = DB::table('tenant_user')
                    ->where('user_id', $user->id)
                    ->where('tenant_id', $invitation->tenant_id)
                    ->first();

                if (! $existingTenantUser) {
                    DB::table('tenant_user')->insert([
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    Log::info('Created tenant_user relationship for existing user', [
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);
                } else {
                    Log::info('Tenant_user relationship already exists for existing user', [
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);
                }
            });

            // Copy user to tenant database for SSO to work properly
            $this->ensureUserExistsInTenant($user, $invitation->tenant);

            // Create entity consent record for administrative access consent
            $this->createAdministrativeConsentRecord($invitation->practitioner, $invitation->tenant);

            // Create terms and privacy consent records in tenant database
            tenancy()->initialize($invitation->tenant);

            try {
                $practitioner = $invitation->practitioner;

                // Get the consent versions
                $termsConsent = \App\Models\Tenant\Consent::where('key', 'practitioner_terms_of_service')->first();
                $privacyConsent = \App\Models\Tenant\Consent::where('key', 'practitioner_privacy_policy')->first();

                if ($termsConsent) {
                    $termsVersion = $termsConsent->activeVersion;
                    if ($termsVersion) {
                        \App\Models\Tenant\EntityConsent::create([
                            'consentable_type' => \App\Models\Practitioner::class,
                            'consentable_id' => $practitioner->id,
                            'consent_version_id' => $termsVersion->id,
                            'consented_at' => now(),
                        ]);
                    }
                }

                if ($privacyConsent) {
                    $privacyVersion = $privacyConsent->activeVersion;
                    if ($privacyVersion) {
                        \App\Models\Tenant\EntityConsent::create([
                            'consentable_type' => \App\Models\Practitioner::class,
                            'consentable_id' => $practitioner->id,
                            'consent_version_id' => $privacyVersion->id,
                            'consented_at' => now(),
                        ]);
                    }
                }

                tenancy()->end();
            } catch (\Exception $e) {
                tenancy()->end();
                Log::warning('Failed to create terms and privacy consents for practitioner', [
                    'practitioner_id' => $invitation->practitioner_id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Log the user in to central domain
            Auth::login($user);

            Log::info('User logged in successfully (existing user)', [
                'user_id' => $user->id,
                'user_email' => $user->email,
            ]);

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            Log::info('=== Redirecting existing user to tenant selection ===', [
                'user_id' => $user->id,
                'tenant_id' => $invitation->tenant_id,
                'tenant_name' => $invitation->tenant->company_name,
                'redirect_route' => 'tenant.selection',
            ]);

            // Redirect to tenant selection - it will auto-redirect if only one tenant
            return redirect()->route('tenant.selection')
                ->with('success', 'Welcome! You have successfully joined '.$invitation->tenant->company_name);

        } catch (\Exception $e) {
            Log::error('Failed to accept existing user invitation', [
                'invitation_id' => $invitation->id,
                'practitioner_id' => $invitation->practitioner_id,
                'tenant_id' => $invitation->tenant_id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your invitation. Please try again.']);
        }
    }

    protected function registerAndAccept(Request $request, PractitionerInvitation $invitation)
    {
        Log::info('=== registerAndAccept Started ===', [
            'invitation_id' => $invitation->id,
            'practitioner_id' => $invitation->practitioner_id,
            'request_data' => $request->all(),
        ]);

        try {
            $validated = $request->validate([
                'password' => 'required|string|min:8|confirmed',
                'terms' => 'accepted',
                'administrative_consent' => 'required|accepted',
            ]);

            Log::info('Validation passed for new user', [
                'validated' => array_merge($validated, ['password' => '[REDACTED]', 'password_confirmation' => '[REDACTED]']),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed for new user', [
                'errors' => $e->errors(),
                'request_data' => $request->except(['password', 'password_confirmation']),
            ]);
            throw $e;
        }

        DB::beginTransaction();

        try {
            // Create user account in central database (NO ROLE ASSIGNED)
            // Roles will be assigned in tenant database only
            $user = User::create([
                'name' => $invitation->practitioner->first_name.' '.$invitation->practitioner->last_name,
                'email' => $invitation->practitioner->email,
                'password' => Hash::make($validated['password']),
                'email_verified_at' => now(), // Auto-verify since they responded to email invitation
            ]);

            // Link user to practitioner
            $invitation->practitioner->update(['user_id' => $user->id]);

            // Accept the invitation
            $invitation->accept();

            // Update tenant-practitioner relationship status to ACCEPTED and ensure tenant_user entry
            tenancy()->central(function () use ($invitation, $user) {
                DB::table('tenant_practitioners')
                    ->where('tenant_id', $invitation->tenant_id)
                    ->where('practitioner_id', $invitation->practitioner_id)
                    ->update([
                        'invitation_status' => 'ACCEPTED',
                        'updated_at' => now(),
                    ]);

                // Create tenant_user relationship if it doesn't exist
                $existingTenantUser = DB::table('tenant_user')
                    ->where('user_id', $user->id)
                    ->where('tenant_id', $invitation->tenant_id)
                    ->first();

                if (! $existingTenantUser) {
                    DB::table('tenant_user')->insert([
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    Log::info('Created tenant_user relationship for new user', [
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);
                } else {
                    Log::info('Tenant_user relationship already exists for new user', [
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);
                }
            });

            DB::commit();

            // Copy user to tenant database for SSO to work properly (after commit)
            $this->ensureUserExistsInTenant($user, $invitation->tenant);

            // Create entity consent record for administrative access consent
            $this->createAdministrativeConsentRecord($invitation->practitioner, $invitation->tenant);

            // Create terms and privacy consent records in tenant database
            tenancy()->initialize($invitation->tenant);

            try {
                $practitioner = $invitation->practitioner;

                // Get the consent versions
                $termsConsent = \App\Models\Tenant\Consent::where('key', 'practitioner_terms_of_service')->first();
                $privacyConsent = \App\Models\Tenant\Consent::where('key', 'practitioner_privacy_policy')->first();

                if ($termsConsent) {
                    $termsVersion = $termsConsent->activeVersion;
                    if ($termsVersion) {
                        \App\Models\Tenant\EntityConsent::create([
                            'consentable_type' => \App\Models\Practitioner::class,
                            'consentable_id' => $practitioner->id,
                            'consent_version_id' => $termsVersion->id,
                            'consented_at' => now(),
                        ]);
                    }
                }

                if ($privacyConsent) {
                    $privacyVersion = $privacyConsent->activeVersion;
                    if ($privacyVersion) {
                        \App\Models\Tenant\EntityConsent::create([
                            'consentable_type' => \App\Models\Practitioner::class,
                            'consentable_id' => $practitioner->id,
                            'consent_version_id' => $privacyVersion->id,
                            'consented_at' => now(),
                        ]);
                    }
                }

                tenancy()->end();
            } catch (\Exception $e) {
                tenancy()->end();
                Log::warning('Failed to create terms and privacy consents for practitioner', [
                    'practitioner_id' => $invitation->practitioner_id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Log the user in to central domain
            Auth::login($user);

            Log::info('User logged in successfully (new user)', [
                'user_id' => $user->id,
                'user_email' => $user->email,
            ]);

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            Log::info('=== Redirecting new user to practitioner dashboard ===', [
                'user_id' => $user->id,
                'tenant_id' => $invitation->tenant_id,
                'tenant_name' => $invitation->tenant->company_name,
                'redirect_route' => 'central.practitioner-dashboard',
            ]);

            // Redirect to tenant selection - it will auto-redirect if only one tenant
            // return redirect()->route('tenant.selection')
            return redirect()->route('central.practitioner-dashboard')
                ->with('success', 'Welcome! Your account has been created and you have successfully joined '.$invitation->tenant->company_name);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to process practitioner invitation', [
                'invitation_id' => $invitation->id,
                'practitioner_id' => $invitation->practitioner_id,
                'tenant_id' => $invitation->tenant_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your invitation. Please try again.']);
        }
    }

    /**
     * Ensure user exists in the tenant database for SSO to work properly
     */
    protected function ensureUserExistsInTenant(User $centralUser, Tenant $tenant)
    {
        try {
            // Initialize tenant context
            tenancy()->initialize($tenant);

            // Check if user already exists in tenant database
            $tenantUser = DB::table('users')
                ->where('email', $centralUser->email)
                ->first();

            if (! $tenantUser) {
                // First, check if the ID is already taken by another user
                $existingUserWithId = DB::table('users')
                    ->where('id', $centralUser->id)
                    ->first();

                if ($existingUserWithId) {
                    // If ID exists but different email, create without specifying ID (let auto-increment handle it)
                    // Use Eloquent model to trigger events (including wallet creation)
                    User::create([
                        'name' => $centralUser->name,
                        'email' => $centralUser->email,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'created_at' => $centralUser->created_at,
                        'updated_at' => $centralUser->updated_at,
                    ]);
                } else {
                    // Use Eloquent model to trigger events (including wallet creation)
                    // Try to create with same ID, fallback to auto-increment if needed
                    try {
                        User::forceCreate([
                            'id' => $centralUser->id,
                            'name' => $centralUser->name,
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                            'created_at' => $centralUser->created_at,
                            'updated_at' => $centralUser->updated_at,
                        ]);
                    } catch (\Exception $e) {
                        // If ID conflict, create without specifying ID
                        User::create([
                            'name' => $centralUser->name,
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                            'created_at' => $centralUser->created_at,
                            'updated_at' => $centralUser->updated_at,
                        ]);
                    }
                }
            }

            // Assign Practitioner role to the user in tenant database
            $tenantUser = User::where('email', $centralUser->email)->first();
            if ($tenantUser) {
                // Check if Practitioner role exists in tenant database
                $practitionerRole = \Spatie\Permission\Models\Role::where('name', 'Practitioner')->first();

                if ($practitionerRole) {
                    // Assign the role to the user
                    $tenantUser->assignRole($practitionerRole);

                    Log::info('Assigned Practitioner role to user in tenant database', [
                        'tenant_id' => $tenant->id,
                        'user_id' => $tenantUser->id,
                        'user_email' => $tenantUser->email,
                        'role' => 'Practitioner',
                    ]);
                } else {
                    Log::warning('Practitioner role not found in tenant database during invitation acceptance', [
                        'tenant_id' => $tenant->id,
                        'user_id' => $tenantUser->id,
                        'user_email' => $tenantUser->email,
                    ]);
                }
            }

            Log::info('Successfully synced user to tenant database', [
                'tenant_id' => $tenant->id,
                'user_id' => $centralUser->id,
                'user_email' => $centralUser->email,
            ]);

        } catch (\Exception $e) {
            // Log error but don't fail the invitation process
            Log::error('Failed to sync user to tenant database', [
                'tenant_id' => $tenant->id,
                'user_id' => $centralUser->id,
                'user_email' => $centralUser->email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
        // NOTE: Do NOT call tenancy()->end() here
        // For invitation routes on central domain: tenant context is manually initialized, so we should clean it up
        // However, we're immediately redirecting to central routes, so the context will be cleaned up naturally
        // Calling tenancy()->end() here would cause issues if this were called from a tenant request
    }

    /**
     * Create entity consent record for administrative access consent.
     */
    private function createAdministrativeConsentRecord($practitioner, $tenant)
    {
        try {
            // Initialize tenancy to access tenant-specific models
            tenancy()->initialize($tenant);

            // Get or create administrative access consent
            $consent = \App\Models\Tenant\Consent::where('key', 'administrative_access_consent')->first();

            if (! $consent) {
                // Create the consent if it doesn't exist
                $consent = \App\Models\Tenant\Consent::create([
                    'key' => 'administrative_access_consent',
                    'title' => 'Administrative Access Consent',
                    'entity_type' => 'PRACTITIONER',
                ]);

                // Create active version
                \App\Models\Tenant\ConsentVersion::create([
                    'consent_id' => $consent->id,
                    'consent_body' => [
                        'heading' => 'Administrative Access Consent',
                        'description' => 'Required for EMR Platform Access',
                        'content' => 'I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel. By checking this box, I acknowledge and agree that authorized administrative staff of Wellovis may view and manage my availability, locations, and appointment metadata (date, time, service) for the exclusive purposes of platform maintenance, technical support, and operational management. This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.',
                        'checkbox_text' => 'I consent to the limited, necessary administrative access to my professional profile and data by Wellovis personnel.',
                        'legal_principle' => 'This access adheres to the legal principle of "Minimum Necessary" use of health information and is required for my use of the Wellovis EMR platform.',
                    ],
                    'status' => 'ACTIVE',
                ]);
            }

            // Check if practitioner has already accepted this consent
            $hasAccepted = \App\Models\Tenant\EntityConsent::where('consent_version_id', $consent->activeVersion->id)
                ->where('consentable_type', 'App\\Models\\Practitioner')
                ->where('consentable_id', $practitioner->id)
                ->exists();

            if (! $hasAccepted) {
                // Create entity consent record
                \App\Models\Tenant\EntityConsent::create([
                    'consent_version_id' => $consent->activeVersion->id,
                    'consentable_type' => 'App\\Models\\Practitioner',
                    'consentable_id' => $practitioner->id,
                    'consented_at' => now(),
                ]);

                Log::info('Administrative access consent record created for practitioner', [
                    'practitioner_id' => $practitioner->id,
                    'tenant_id' => $tenant->id,
                    'consent_key' => 'administrative_access_consent',
                ]);
            }

            tenancy()->end();

        } catch (\Exception $e) {
            tenancy()->end();
            Log::error('Failed to create administrative consent record', [
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle existing practitioner registration (similar to acceptExistingUser)
     */
    protected function handleExistingPractitionerRegistration(Request $request, PractitionerInvitation $invitation, Practitioner $practitioner, User $user)
    {
        Log::info('=== handleExistingPractitionerRegistration Started ===', [
            'invitation_id' => $invitation->id,
            'practitioner_id' => $practitioner->id,
            'user_id' => $user->id,
        ]);

        // Validate administrative consent (no password or terms needed for existing users)
        try {
            $validated = $request->validate([
                'administrative_consent' => 'required|accepted',
                'consents_accepted' => 'required|accepted',
            ]);

            Log::info('Validation passed for existing practitioner self-registration', [
                'validated' => $validated,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed for existing practitioner self-registration', [
                'errors' => $e->errors(),
            ]);
            throw $e;
        }

        try {
            // Check if practitioner-tenant relationship existed before this invitation
            $hadPreviousRelationship = false;
            tenancy()->central(function () use (&$hadPreviousRelationship, $practitioner, $invitation) {
                $existingRelationship = DB::table('tenant_practitioners')
                    ->where('practitioner_id', $practitioner->id)
                    ->where('tenant_id', $invitation->tenant_id)
                    ->first();

                $hadPreviousRelationship = (bool) $existingRelationship;
            });

            // Update invitation with practitioner_id if not set
            if (! $invitation->practitioner_id) {
                $invitation->update(['practitioner_id' => $practitioner->id]);
            }

            // Accept the invitation
            $invitation->accept();

            // Update tenant-practitioner relationship status to ACCEPTED and ensure tenant_user entry
            tenancy()->central(function () use ($invitation, $user, $practitioner) {
                $existingRelationship = DB::table('tenant_practitioners')
                    ->where('tenant_id', $invitation->tenant_id)
                    ->where('practitioner_id', $practitioner->id)
                    ->first();

                if ($existingRelationship) {
                    // Update existing relationship
                    DB::table('tenant_practitioners')
                        ->where('tenant_id', $invitation->tenant_id)
                        ->where('practitioner_id', $practitioner->id)
                        ->update([
                            'invitation_status' => 'ACCEPTED',
                            'updated_at' => now(),
                        ]);
                } else {
                    // Create new relationship
                    DB::table('tenant_practitioners')->insert([
                        'tenant_id' => $invitation->tenant_id,
                        'practitioner_id' => $practitioner->id,
                        'invitation_status' => 'ACCEPTED',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                // Create tenant_user relationship if it doesn't exist
                $existingTenantUser = DB::table('tenant_user')
                    ->where('user_id', $user->id)
                    ->where('tenant_id', $invitation->tenant_id)
                    ->first();

                if (! $existingTenantUser) {
                    DB::table('tenant_user')->insert([
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    Log::info('Created tenant_user relationship for existing practitioner', [
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);
                }
            });

            // Copy user to tenant database for SSO to work properly
            $this->ensureUserExistsInTenant($user, $invitation->tenant);

            // Sync practitioner to tenant database
            $this->syncPractitionerToTenant($practitioner, $invitation->tenant);

            // Create all required consent records in tenant database
            $this->createAllRequiredConsents($practitioner, $invitation->tenant);

            // Log the user in
            Auth::login($user);

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            Log::info('=== Redirecting existing practitioner ===', [
                'user_id' => $user->id,
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $invitation->tenant_id,
                'tenant_name' => $invitation->tenant->company_name,
                'had_previous_relationship' => $hadPreviousRelationship,
                'redirect_to' => $hadPreviousRelationship ? 'central' : 'tenant',
            ]);

            // If practitioner is NEW to this tenant, redirect to tenant dashboard
            // If practitioner already had relationship with tenant, redirect to central
            if (! $hadPreviousRelationship) {
                // First time joining this tenant → redirect to tenant dashboard via SSO
                try {
                    $tenantSessionService = app(\App\Services\TenantSessionService::class);
                    $url = $tenantSessionService->switchToTenant($user, $invitation->tenant, '/dashboard');

                    return Inertia::location($url);
                } catch (\Exception $e) {
                    Log::error('Failed to redirect to tenant dashboard, falling back to central', [
                        'error' => $e->getMessage(),
                        'user_id' => $user->id,
                        'tenant_id' => $invitation->tenant_id,
                    ]);

                    // Fallback to central dashboard if tenant redirect fails
                    return redirect()->route('central.practitioner-dashboard')
                        ->with('success', 'Welcome! You have successfully joined '.$invitation->tenant->company_name);
                }
            } else {
                // Already was part of this tenant → redirect to central dashboard
                return redirect()->route('central.practitioner-dashboard')
                    ->with('success', 'Welcome back! You have successfully rejoined '.$invitation->tenant->company_name);
            }

        } catch (\Exception $e) {
            Log::error('Failed to process existing practitioner self-registration', [
                'invitation_id' => $invitation->id,
                'practitioner_id' => $practitioner->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your registration. Please try again.']);
        }
    }

    public function handleSelfRegistration(Request $request, $token)
    {
        $invitation = PractitionerInvitation::where('token', $token)
            ->with(['tenant'])
            ->firstOrFail();

        // Check if invitation is valid
        if ($invitation->status !== 'pending' || $invitation->isExpired()) {
            return back()->withErrors(['invitation' => 'This invitation is no longer valid or has expired.']);
        }

        // Check if this is an email-only invitation
        if (! $invitation->isEmailOnlyInvitation()) {
            return back()->withErrors(['invitation' => 'This invitation type does not support self-registration.']);
        }

        // Check if a practitioner with this email already exists and has a user account
        $existingPractitioner = null;
        $existingUser = null;

        tenancy()->central(function () use (&$existingPractitioner, &$existingUser, $invitation) {
            $existingUser = User::where('email', $invitation->email)->first();
            if ($existingUser) {
                $existingPractitioner = Practitioner::where('user_id', $existingUser->id)->first();
            }
        });

        // If existing practitioner with user account, handle like acceptExistingUser
        if ($existingPractitioner && $existingUser) {
            Log::info('Existing practitioner found in self-registration, routing to existing user flow', [
                'invitation_id' => $invitation->id,
                'practitioner_id' => $existingPractitioner->id,
                'user_id' => $existingUser->id,
            ]);

            return $this->handleExistingPractitionerRegistration($request, $invitation, $existingPractitioner, $existingUser);
        }

        // If user exists but no practitioner, we need to create practitioner and link to existing user
        // This handles the case where user was created but practitioner registration wasn't completed
        if ($existingUser && ! $existingPractitioner) {
            Log::info('Existing user found without practitioner in self-registration, will create practitioner and link', [
                'invitation_id' => $invitation->id,
                'user_id' => $existingUser->id,
            ]);
        }

        // Validate the form data
        $validated = $request->validate([
            // Personal Info
            'first_name' => ['required', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:50'],
            'title' => ['required', 'string', 'in:Dr.,Mr.,Ms.,Mrs.'],
            'phone_number' => ['required', 'string', 'max:20'],
            'extension' => ['required', 'string', 'max:10'],
            'gender' => ['required', 'string', 'in:male,female,other,prefer_not_to_say'],
            'pronoun' => ['required', 'string', 'max:20'],
            'short_bio' => ['nullable', 'string', 'max:255'],
            'full_bio' => ['nullable', 'string', 'max:2000'],

            // Professional Details
            'credentials' => ['required', 'array', 'min:1'],
            'credentials.*' => ['string', 'in:MD,PhD,PsyD,MA,MS,MSW,LCSW,LMFT,LPC,LCPC,LPCC,LMHC,RN,NP,PA,Other'],
            'years_of_experience' => ['required', 'string', 'in:0-1 years,2-5 years,6-10 years,11-15 years,16-20 years,20+ years'],
            'license_number' => ['required', 'string', 'max:100'],
            'professional_associations' => ['required', 'array', 'min:1'],
            'professional_associations.*' => ['string', 'in:APA,CPA,NASW'],
            'primary_specialties' => ['required', 'array', 'min:1'],
            'primary_specialties.*' => ['string'],
            'therapeutic_modalities' => ['required', 'array', 'min:1'],
            'therapeutic_modalities.*' => ['string'],
            'client_types_served' => ['required', 'array', 'min:1'],
            'client_types_served.*' => ['string'],
            'languages_spoken' => ['required', 'array', 'min:1'],
            'languages_spoken.*' => ['string'],

            // Account
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'terms' => ['accepted'],

            // Consents
            'consents_accepted' => ['required', 'accepted'],
        ]);

        DB::beginTransaction();

        try {
            // Create new practitioner in central database
            $practitioner = null;
            tenancy()->central(function () use (&$practitioner, $validated, $invitation) {
                // Generate unique slug for new practitioner
                $baseSlug = Str::slug($validated['first_name'].' '.$validated['last_name']);
                $slug = $baseSlug;
                $counter = 1;

                while (Practitioner::where('slug', $slug)->exists()) {
                    $slug = $baseSlug.'-'.$counter;
                    $counter++;
                }

                $practitioner = Practitioner::create([
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'title' => $validated['title'],
                    'email' => $invitation->email,
                    'phone_number' => $validated['phone_number'],
                    'extension' => $validated['extension'],
                    'gender' => $validated['gender'],
                    'pronoun' => $validated['pronoun'],
                    'short_bio' => $validated['short_bio'] ?? null,
                    'full_bio' => $validated['full_bio'] ?? null,
                    'credentials' => $validated['credentials'],
                    'years_of_experience' => $validated['years_of_experience'],
                    'license_number' => $validated['license_number'],
                    'professional_associations' => $validated['professional_associations'],
                    'primary_specialties' => $validated['primary_specialties'],
                    'therapeutic_modalities' => $validated['therapeutic_modalities'],
                    'client_types_served' => $validated['client_types_served'],
                    'languages_spoken' => $validated['languages_spoken'],
                    'is_active' => true,
                    'meta_data' => ['is_onboarding' => 1],
                ]);

                // Set slug directly (bypasses $fillable)
                $practitioner->slug = $slug;
                $practitioner->saveQuietly();

                Log::info('Created practitioner via self-registration', [
                    'practitioner_id' => $practitioner->id,
                    'email' => $practitioner->email,
                    'slug' => $practitioner->slug,
                ]);
            });

            // Create new user account in central database (or use existing if user already exists)
            if ($existingUser && ! $existingPractitioner) {
                // User exists but no practitioner - update password and use existing user
                $user = $existingUser;
                $user->update([
                    'name' => $validated['first_name'].' '.$validated['last_name'],
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now(), // Auto-verify since they responded to email invitation
                ]);

                Log::info('Updated existing user account for practitioner self-registration', [
                    'user_id' => $user->id,
                ]);
            } else {
                // Create new user account
                $user = User::create([
                    'name' => $validated['first_name'].' '.$validated['last_name'],
                    'email' => $invitation->email,
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now(), // Auto-verify since they responded to email invitation
                ]);

                Log::info('Created new user account for practitioner via self-registration', [
                    'user_id' => $user->id,
                ]);
            }

            // Link user to practitioner in central database
            tenancy()->central(function () use ($practitioner, $user) {
                $practitioner->update(['user_id' => $user->id]);
            });

            Log::info('Linked user to practitioner via self-registration', [
                'user_id' => $user->id,
                'practitioner_id' => $practitioner->id,
            ]);

            // Link practitioner to tenant
            tenancy()->central(function () use ($invitation, $practitioner) {
                DB::table('tenant_practitioners')->insert([
                    'tenant_id' => $invitation->tenant_id,
                    'practitioner_id' => $practitioner->id,
                    'invitation_status' => 'ACCEPTED',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            // Create tenant_user relationship in central database
            tenancy()->central(function () use ($invitation, $user) {
                DB::table('tenant_user')->insert([
                    'user_id' => $user->id,
                    'tenant_id' => $invitation->tenant_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            // Update invitation with practitioner_id and accept it
            $invitation->update([
                'practitioner_id' => $practitioner->id,
            ]);
            $invitation->accept();

            DB::commit();

            // Copy user to tenant database for SSO to work properly (after commit)
            $this->ensureUserExistsInTenant($user, $invitation->tenant);

            // Sync practitioner to tenant database
            $this->syncPractitionerToTenant($practitioner, $invitation->tenant);

            // Create all required consent records in tenant database
            $this->createAllRequiredConsents($practitioner, $invitation->tenant);

            // Log the user in to central domain
            Auth::login($user);

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            // Redirect to central practitioner dashboard
            return redirect()->route('central.practitioner-dashboard')
                ->with('success', 'Welcome! Your account has been created and you have successfully joined '.$invitation->tenant->company_name);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to process practitioner self-registration', [
                'invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'tenant_id' => $invitation->tenant_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your registration. Please try again.'])->withInput();
        }
    }

    /**
     * Create all required consent records for practitioner in tenant database
     *
     * @param  \App\Models\Practitioner  $practitioner
     * @param  \App\Models\Tenant  $tenant
     */
    private function createAllRequiredConsents($practitioner, $tenant): void
    {
        try {
            // Initialize tenancy to access tenant-specific models
            tenancy()->initialize($tenant);

            // Get all consents for practitioners
            $requiredConsents = \App\Models\Tenant\Consent::where('entity_type', 'PRACTITIONER')
                ->with('activeVersion')
                ->get();

            foreach ($requiredConsents as $consent) {
                if ($consent->activeVersion) {
                    // Check if practitioner has already accepted this consent
                    $hasAccepted = \App\Models\Tenant\EntityConsent::where('consent_version_id', $consent->activeVersion->id)
                        ->where('consentable_type', 'App\\Models\\Practitioner')
                        ->where('consentable_id', $practitioner->id)
                        ->exists();

                    if (! $hasAccepted) {
                        // Create entity consent record
                        \App\Models\Tenant\EntityConsent::create([
                            'consent_version_id' => $consent->activeVersion->id,
                            'consentable_type' => 'App\\Models\\Practitioner',
                            'consentable_id' => $practitioner->id,
                            'consented_at' => now(),
                        ]);

                        Log::info('Consent record created for practitioner during self-registration', [
                            'practitioner_id' => $practitioner->id,
                            'tenant_id' => $tenant->id,
                            'consent_key' => $consent->key,
                            'consent_id' => $consent->id,
                        ]);
                    }
                }
            }

            tenancy()->end();

            Log::info('All required consents created for practitioner during self-registration', [
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $tenant->id,
                'total_consents' => $requiredConsents->count(),
            ]);

        } catch (\Exception $e) {
            tenancy()->end();
            Log::error('Failed to create required consents for practitioner during self-registration', [
                'practitioner_id' => $practitioner->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Sync practitioner from central database to tenant database
     *
     * @param  \App\Models\Practitioner  $centralPractitioner
     * @param  \App\Models\Tenant  $tenant
     */
    private function syncPractitionerToTenant($centralPractitioner, $tenant): void
    {
        try {
            // Initialize tenancy to access tenant-specific database
            tenancy()->initialize($tenant);

            // Sync practitioner data to tenant database
            $tenantPractitioner = \App\Models\Practitioner::syncFromCentral($centralPractitioner);

            Log::info('Practitioner synced to tenant database', [
                'central_practitioner_id' => $centralPractitioner->id,
                'tenant_practitioner_id' => $tenantPractitioner->id,
                'tenant_id' => $tenant->id,
            ]);

            tenancy()->end();

        } catch (\Exception $e) {
            tenancy()->end();
            Log::error('Failed to sync practitioner to tenant database', [
                'central_practitioner_id' => $centralPractitioner->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't throw - this is not critical for the invitation process
        }
    }
}
