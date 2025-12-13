<?php

namespace App\Http\Controllers;

use App\Mail\PatientInvitationAcceptedMail;
use App\Models\Tenant;
use App\Models\Tenant\Patient;
use App\Models\Tenant\PatientInvitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class PatientInvitationController extends Controller
{
    public function show($token)
    {
        // Invitation is tenant-scoped, so we look it up in the current tenant's database
        $invitation = PatientInvitation::where('token', $token)
            ->with(['patient'])
            ->firstOrFail();

        // Check if invitation is valid
        if ($invitation->status !== 'pending' || $invitation->isExpired()) {
            return Inertia::render('auth/invitation-expired', [
                'message' => $invitation->isExpired()
                    ? 'This invitation has expired.'
                    : 'This invitation is no longer valid.',
            ]);
        }

        // Check if patient already has a user account
        $requiresRegistration = $invitation->patient->user_id === null;

        // Get current tenant from context
        $tenant = tenant();

        return Inertia::render('auth/patient-invitation', [
            'invitation' => $invitation,
            'patient' => $invitation->patient,
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? $tenant->id,
            ],
            'token' => $token,
            'requiresRegistration' => $requiresRegistration,
        ]);
    }

    public function accept(Request $request, $token)
    {
        // Invitation is tenant-scoped
        $invitation = PatientInvitation::where('token', $token)
            ->with(['patient'])
            ->firstOrFail();

        Log::info('Processing patient invitation acceptance', [$invitation]);

        // Check if invitation is valid
        if ($invitation->status !== 'pending' || $invitation->isExpired()) {
            return back()->withErrors(['invitation' => 'This invitation is no longer valid or has expired.']);
        }

        // Scenario 1: Patient already has user account - just accept invitation to join tenant
        if ($invitation->patient->user_id) {
            return $this->acceptExistingUser($invitation);
        }

        // Scenario 2: First-time patient - needs to set password and register
        return $this->registerAndAccept($request, $invitation);
    }

    protected function acceptExistingUser(PatientInvitation $invitation)
    {
        // Get current tenant
        $currentTenant = tenant();
        $currentTenantId = $currentTenant->id;

        // Find the user
        $user = User::find($invitation->patient->user_id);

        if (! $user) {
            return back()->withErrors(['user' => 'User account not found.']);
        }

        try {
            // Accept the invitation
            $invitation->accept();

            // Ensure tenant_user entry exists and create central patient record
            // Use separate transaction to ensure persistence
            tenancy()->central(function () use ($currentTenantId, $user, $invitation) {
                DB::connection('central')->beginTransaction();

                try {
                    // Create tenant_user relationship if it doesn't exist
                    $existingTenantUser = DB::table('tenant_user')
                        ->where('user_id', $user->id)
                        ->where('tenant_id', $currentTenantId)
                        ->first();

                    if (! $existingTenantUser) {
                        DB::table('tenant_user')->insert([
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenantId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        Log::info('Created tenant_user relationship for existing patient user', [
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenantId,
                            'patient_id' => $invitation->patient_id,
                        ]);
                    }

                    // Ensure central patient record exists for dashboard access
                    $centralPatient = \App\Models\Patient::where('user_id', $user->id)->first();
                    if (! $centralPatient) {
                        \App\Models\Patient::create([
                            'user_id' => $user->id,
                            'health_number' => 'CENTRAL-'.$user->id, // Placeholder for central dashboard record
                            'email' => $invitation->patient->email,
                            'first_name' => $invitation->patient->first_name,
                            'last_name' => $invitation->patient->last_name,
                            'preferred_name' => $invitation->patient->preferred_name,
                            'phone_number' => $invitation->patient->phone_number,
                            'date_of_birth' => $invitation->patient->date_of_birth,
                            'gender_pronouns' => $invitation->patient->gender_pronouns,
                            'client_type' => $invitation->patient->client_type,
                            'emergency_contact_phone' => $invitation->patient->emergency_contact_phone,
                        ]);

                        Log::info('Created central patient record for existing user (invitation)', [
                            'user_id' => $user->id,
                            'email' => $invitation->patient->email,
                        ]);
                    }

                    DB::connection('central')->commit();
                } catch (\Exception $e) {
                    DB::connection('central')->rollBack();
                    Log::error('Failed to create central patient/tenant_user for existing user', [
                        'error' => $e->getMessage(),
                        'user_id' => $user->id,
                    ]);
                    throw $e;
                }
            });

            // Copy user to tenant database for SSO to work properly
            $this->ensureUserExistsInTenant($user, $currentTenant);

            $this->sendInvitationAcceptedEmail($invitation, false, $currentTenant);
            // Instead of auto-login, redirect to login page with success message
            Log::info('Patient invitation accepted successfully - redirecting to login', [
                'user_id' => $user->id,
                'patient_id' => $invitation->patient_id,
                'tenant_id' => $currentTenantId,
                'email' => $user->email,
            ]);

            // Redirect to central login with session flash message
            session()->flash('status', 'Invitation accepted successfully! Please log in to access your patient portal.');

            return Inertia::location(centralUrl().'/login');

        } catch (\Exception $e) {
            Log::error('Error accepting patient invitation for existing user', [
                'invitation_id' => $invitation->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return back()->withErrors(['error' => 'Failed to accept invitation. Please try again.']);
        }
    }

    protected function registerAndAccept(Request $request, PatientInvitation $invitation)
    {
        Log::info('=== registerAndAccept Started ===', [
            'invitation_id' => $invitation->id,
            'patient_id' => $invitation->patient_id,
            'patient_email' => $invitation->patient->email,
            'patient_user_id' => $invitation->patient->user_id,
        ]);

        $request->validate([
            'password' => ['required', 'min:8', 'confirmed'],
            'terms' => 'accepted',
        ]);

        // Get current tenant
        $currentTenant = tenant();
        $currentTenantId = $currentTenant->id;

        Log::info('Tenant context established', [
            'tenant_id' => $currentTenantId,
            'tenant_name' => $currentTenant->company_name ?? $currentTenant->id,
        ]);

        // Store patient data before entering central context (patient is tenant-scoped)
        $patientEmail = $invitation->patient->email;
        $patientFirstName = $invitation->patient->first_name;
        $patientLastName = $invitation->patient->last_name;
        $patientPreferredName = $invitation->patient->preferred_name;
        $patientPhoneNumber = $invitation->patient->phone_number;
        $patientDateOfBirth = $invitation->patient->date_of_birth;
        $patientGenderPronouns = $invitation->patient->gender_pronouns;
        $patientClientType = $invitation->patient->client_type;
        $patientEmergencyContactPhone = $invitation->patient->emergency_contact_phone;
        $patientId = $invitation->patient_id;

        Log::info('Patient data extracted from tenant context', [
            'patient_id' => $patientId,
            'email' => $patientEmail,
        ]);

        try {
            DB::beginTransaction();

            // Create user account in central database with separate transaction
            $user = null;
            tenancy()->central(function () use (&$user, $request, $currentTenantId, $patientEmail, $patientFirstName, $patientLastName, $patientPreferredName, $patientPhoneNumber, $patientDateOfBirth, $patientGenderPronouns, $patientClientType, $patientEmergencyContactPhone) {
                Log::info('Entered central database context', [
                    'current_connection' => DB::connection()->getName(),
                ]);

                DB::connection('central')->beginTransaction();

                try {
                    Log::info('Checking for existing user in central database', [
                        'email' => $patientEmail,
                    ]);

                    // Check if user already exists with this email
                    $existingUser = User::where('email', $patientEmail)->first();

                    if ($existingUser) {
                        Log::info('Found existing user, updating password', [
                            'user_id' => $existingUser->id,
                            'email' => $patientEmail,
                        ]);

                        // User exists - update password and email verification
                        $existingUser->update([
                            'password' => Hash::make($request->password),
                            'email_verified_at' => now(),
                        ]);
                        $user = $existingUser;

                        Log::info('Updated existing user password for patient invitation', [
                            'user_id' => $user->id,
                            'email' => $patientEmail,
                        ]);
                    } else {
                        Log::info('No existing user found, creating new user', [
                            'email' => $patientEmail,
                        ]);

                        // Create new user
                        $user = User::create([
                            'name' => $patientFirstName.' '.$patientLastName,
                            'email' => $patientEmail,
                            'password' => Hash::make($request->password),
                            'email_verified_at' => now(),
                        ]);

                        Log::info('Created new user account for patient invitation', [
                            'user_id' => $user->id,
                            'email' => $patientEmail,
                        ]);
                    }

                    // Ensure tenant_user relationship
                    Log::info('Checking tenant_user relationship', [
                        'user_id' => $user->id,
                        'tenant_id' => $currentTenantId,
                    ]);

                    $existingTenantUser = DB::table('tenant_user')
                        ->where('user_id', $user->id)
                        ->where('tenant_id', $currentTenantId)
                        ->first();

                    if (! $existingTenantUser) {
                        Log::info('Creating tenant_user relationship', [
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenantId,
                        ]);

                        DB::table('tenant_user')->insert([
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenantId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    } else {
                        Log::info('tenant_user relationship already exists', [
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenantId,
                        ]);
                    }

                    // Create or update central patient record for dashboard access
                    // CRITICAL: Must ensure email and user_id are always set in central patients table
                    Log::info('Checking for central patient record', [
                        'user_id' => $user->id,
                        'email' => $patientEmail,
                    ]);

                    // Check by user_id first, then by email
                    $centralPatient = \App\Models\Patient::where('user_id', $user->id)->first();
                    if (! $centralPatient) {
                        // Try to find by email
                        $centralPatient = \App\Models\Patient::where('email', $patientEmail)->first();
                    }

                    if (! $centralPatient) {
                        Log::info('Creating new central patient record with user_id and email', [
                            'user_id' => $user->id,
                            'email' => $patientEmail,
                        ]);

                        $centralPatient = \App\Models\Patient::create([
                            'user_id' => $user->id,
                            'health_number' => 'CENTRAL-'.$user->id, // Placeholder for central dashboard record
                            'email' => $patientEmail,
                            'first_name' => $patientFirstName,
                            'last_name' => $patientLastName,
                            'preferred_name' => $patientPreferredName,
                            'phone_number' => $patientPhoneNumber,
                            'date_of_birth' => $patientDateOfBirth,
                            'gender_pronouns' => $patientGenderPronouns,
                            'client_type' => $patientClientType,
                            'emergency_contact_phone' => $patientEmergencyContactPhone,
                        ]);

                        Log::info('Created central patient record for dashboard access (invitation)', [
                            'patient_id' => $centralPatient->id,
                            'user_id' => $user->id,
                            'email' => $patientEmail,
                        ]);
                    } else {
                        // Update existing central patient to ensure user_id and email are set
                        $needsUpdate = false;
                        $updateData = [];

                        if ($centralPatient->user_id !== $user->id) {
                            $updateData['user_id'] = $user->id;
                            $needsUpdate = true;
                            Log::info('Central patient missing user_id, will update', [
                                'patient_id' => $centralPatient->id,
                                'current_user_id' => $centralPatient->user_id,
                                'new_user_id' => $user->id,
                            ]);
                        }

                        if ($centralPatient->email !== $patientEmail) {
                            $updateData['email'] = $patientEmail;
                            $needsUpdate = true;
                            Log::info('Central patient email mismatch, will update', [
                                'patient_id' => $centralPatient->id,
                                'current_email' => $centralPatient->email,
                                'new_email' => $patientEmail,
                            ]);
                        }

                        // Also update other patient data if available
                        if ($patientFirstName && $centralPatient->first_name !== $patientFirstName) {
                            $updateData['first_name'] = $patientFirstName;
                            $needsUpdate = true;
                        }
                        if ($patientLastName && $centralPatient->last_name !== $patientLastName) {
                            $updateData['last_name'] = $patientLastName;
                            $needsUpdate = true;
                        }

                        if ($needsUpdate) {
                            $centralPatient->update($updateData);
                            Log::info('Updated central patient record with user_id and email', [
                                'patient_id' => $centralPatient->id,
                                'user_id' => $centralPatient->user_id,
                                'email' => $centralPatient->email,
                                'updated_fields' => array_keys($updateData),
                            ]);
                        } else {
                            Log::info('Central patient record already exists with correct user_id and email', [
                                'patient_id' => $centralPatient->id,
                                'user_id' => $centralPatient->user_id,
                                'email' => $centralPatient->email,
                            ]);
                        }
                    }

                    // Final verification: Ensure central patient has user_id and email
                    $centralPatient = $centralPatient->fresh();
                    Log::info('Verified central patient record after all operations', [
                        'patient_id' => $centralPatient->id,
                        'user_id' => $centralPatient->user_id,
                        'email' => $centralPatient->email,
                        'user_id_set' => ! is_null($centralPatient->user_id),
                        'email_set' => ! is_null($centralPatient->email),
                    ]);

                    Log::info('Processed user account for patient invitation in central database', [
                        'user_id' => $user->id,
                        'tenant_id' => $currentTenantId,
                        'email' => $patientEmail,
                        'central_patient_id' => $centralPatient->id,
                    ]);

                    DB::connection('central')->commit();
                    Log::info('Central database transaction committed');
                } catch (\Exception $e) {
                    DB::connection('central')->rollBack();
                    Log::error('Failed to create central user/patient for new invitation', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                        'email' => $patientEmail,
                    ]);
                    throw $e;
                }
            });

            Log::info('Exited central database context, now in tenant context', [
                'current_connection' => DB::connection()->getName(),
                'user_id' => $user?->id,
            ]);

            // Link user to patient (this must be done in tenant context)
            if ($user) {
                // CRITICAL: Ensure user exists in tenant database BEFORE linking patient
                // The foreign key constraint requires the user to exist in tenant DB
                Log::info('Ensuring user exists in tenant database before linking patient', [
                    'user_id' => $user->id,
                    'tenant_id' => $currentTenantId,
                ]);

                $this->ensureUserExistsInTenant($user, $currentTenant);

                // Re-initialize tenancy since ensureUserExistsInTenant ends it
                tenancy()->initialize($currentTenant);

                Log::info('User confirmed in tenant database, now linking to patient', [
                    'user_id' => $user->id,
                    'patient_id' => $patientId,
                    'current_connection' => DB::connection()->getName(),
                ]);

                $invitation->patient->update(['user_id' => $user->id]);
                $patient = $invitation->patient->fresh();

                Log::info('Successfully linked user to patient', [
                    'user_id' => $user->id,
                    'patient_id' => $patient->id,
                    'patient_user_id' => $patient->user_id,
                ]);
            } else {
                throw new \Exception('User was not created in central database');
            }

            // Accept the invitation
            Log::info('Accepting patient invitation', [
                'invitation_id' => $invitation->id,
                'patient_id' => $patient->id,
            ]);

            $invitation->accept();

            Log::info('Patient invitation accepted successfully', [
                'invitation_id' => $invitation->id,
                'invitation_status' => $invitation->status,
            ]);

            DB::commit();
            Log::info('Tenant database transaction committed');

            // Verify user exists in tenant DB for SSO (already synced earlier, but double-check)
            if ($user) {
                Log::info('Verifying user exists in tenant database for SSO', [
                    'user_id' => $user->id,
                    'tenant_id' => $currentTenantId,
                ]);

                $this->ensureUserExistsInTenant($user, $currentTenant);

                Log::info('Sending invitation accepted email', [
                    'patient_id' => $patient->id,
                    'email' => $patient->email,
                ]);

                $this->sendInvitationAcceptedEmail($invitation, true, $currentTenant);
            }

            // Create terms and privacy consent records in tenant database
            if ($patient) {
                Log::info('Creating terms and privacy consent records', [
                    'patient_id' => $patient->id,
                ]);

                tenancy()->initialize($currentTenant);

                try {
                    // Get the consent versions
                    $termsConsent = \App\Models\Tenant\Consent::where('key', 'patient_terms_of_service')->first();
                    $privacyConsent = \App\Models\Tenant\Consent::where('key', 'patient_privacy_policy')->first();

                    if ($termsConsent) {
                        $termsVersion = $termsConsent->activeVersion;
                        if ($termsVersion) {
                            \App\Models\Tenant\EntityConsent::create([
                                'consentable_type' => Patient::class,
                                'consentable_id' => $patient->id,
                                'consent_version_id' => $termsVersion->id,
                                'consented_at' => now(),
                            ]);

                            Log::info('Created terms of service consent', [
                                'patient_id' => $patient->id,
                                'consent_version_id' => $termsVersion->id,
                            ]);
                        }
                    }

                    if ($privacyConsent) {
                        $privacyVersion = $privacyConsent->activeVersion;
                        if ($privacyVersion) {
                            \App\Models\Tenant\EntityConsent::create([
                                'consentable_type' => Patient::class,
                                'consentable_id' => $patient->id,
                                'consent_version_id' => $privacyVersion->id,
                                'consented_at' => now(),
                            ]);

                            Log::info('Created privacy policy consent', [
                                'patient_id' => $patient->id,
                                'consent_version_id' => $privacyVersion->id,
                            ]);
                        }
                    }

                    tenancy()->end();
                } catch (\Exception $e) {
                    tenancy()->end();
                    Log::warning('Failed to create terms and privacy consents for patient', [
                        'patient_id' => $patient->id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            }

            // End tenant context before redirecting to central
            tenancy()->end();

            // Auto-login on the central guard
            Log::info('Logging in user for central dashboard', [
                'user_id' => $user->id,
                'email' => $user->email,
            ]);

            Auth::login($user);

            // Align with absolute session timeout logic
            session(['login_time' => now()->timestamp]);

            Log::info('=== registerAndAccept Completed Successfully ===', [
                'user_id' => $user->id,
                'patient_id' => $patient->id,
                'tenant_id' => $currentTenantId,
                'redirect_route' => 'central.patient-dashboard',
            ]);

            // Redirect to central patient dashboard using Inertia::location to ensure central domain
            $dashboardUrl = centralUrl('/central/patient-dashboard');

            Log::info('Redirecting to central patient dashboard', [
                'url' => $dashboardUrl,
                'user_id' => $user->id,
            ]);

            return Inertia::location($dashboardUrl);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('=== Error registering and accepting patient invitation ===', [
                'invitation_id' => $invitation->id,
                'patient_id' => $patientId ?? null,
                'patient_email' => $patientEmail ?? null,
                'user_id' => isset($user) && $user ? $user->id : null,
                'tenant_id' => $currentTenantId ?? null,
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return back()->withErrors(['error' => 'Failed to create account and accept invitation. Please try again.']);
        }
    }

    protected function sendInvitationAcceptedEmail(PatientInvitation $invitation, bool $isNewUser, Tenant $tenant)
    {
        try {
            // Reload the invitation with patient relationship
            $invitation->load(['patient']);

            Mail::to($invitation->patient->email)->send(
                new PatientInvitationAcceptedMail($invitation, $isNewUser)
            );

            Log::info('Patient invitation accepted email sent successfully', [
                'patient_id' => $invitation->patient_id,
                'email' => $invitation->patient->email,
                'tenant_id' => $tenant->id,
                'invitation_id' => $invitation->id,
                'is_new_user' => $isNewUser,
                'company_name' => $tenant->company_name,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send patient invitation accepted email', [
                'patient_id' => $invitation->patient_id,
                'email' => $invitation->patient->email,
                'tenant_id' => $tenant->id,
                'invitation_id' => $invitation->id,
                'is_new_user' => $isNewUser,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail the entire process if email fails
            // Just log the error and continue
        }
    }

    /**
     * Ensure user exists in tenant database for SSO to work properly
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
                    DB::table('users')->insert([
                        'name' => $centralUser->name,
                        'email' => $centralUser->email,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'created_at' => $centralUser->created_at,
                        'updated_at' => $centralUser->updated_at,
                    ]);
                } else {
                    // Create user in tenant database with same ID
                    DB::table('users')->insert([
                        'id' => $centralUser->id,
                        'name' => $centralUser->name,
                        'email' => $centralUser->email,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'created_at' => $centralUser->created_at,
                        'updated_at' => $centralUser->updated_at,
                    ]);
                }
            } else {
                // Update existing user to ensure data is in sync
                DB::table('users')
                    ->where('email', $centralUser->email)
                    ->update([
                        'name' => $centralUser->name,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'updated_at' => now(),
                    ]);
            }

            // Assign Patient role to the user in tenant database
            $tenantUser = User::where('email', $centralUser->email)->first();
            if ($tenantUser) {
                // Check if Patient role exists in tenant database
                $patientRole = \Spatie\Permission\Models\Role::where('name', 'Patient')->first();

                if ($patientRole) {
                    $tenantUser->assignRole($patientRole);
                    Log::info('Assigned Patient role to user in tenant database', [
                        'tenant_id' => $tenant->id,
                        'user_id' => $tenantUser->id,
                        'user_email' => $tenantUser->email,
                        'role' => 'Patient',
                    ]);
                } else {
                    Log::warning('Patient role not found in tenant database during invitation acceptance', [
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
        } finally {
            // Clean up tenant context
            tenancy()->end();
        }
    }
}
