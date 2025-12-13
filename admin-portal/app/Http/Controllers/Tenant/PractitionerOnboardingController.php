<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\OrganizationSetting;
use App\Models\Practitioner;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class PractitionerOnboardingController extends Controller
{
    /**
     * Show combined practitioner questions (solo and group practice)
     */
    public function showQuestions()
    {
        $practiceType = OrganizationSetting::getValue('practice_type', null);

        // Only show this for solo or group practice
        if ($practiceType !== 'solo' && $practiceType !== 'group') {
            return redirect()->route('onboarding.index');
        }

        $isPractitioner = OrganizationSetting::getValue('is_practitioner', null);
        $registerTiming = OrganizationSetting::getValue('practitioner_register_timing', null);

        return Inertia::render('onboarding-practitioner-questions', [
            'isPractitioner' => $isPractitioner === 'true' ? true : ($isPractitioner === 'false' ? false : null),
            'registerTiming' => $registerTiming,
        ]);
    }

    /**
     * Save answers to both practitioner questions (combined submission)
     */
    public function savePractitionerQuestion(Request $request)
    {
        $validated = $request->validate([
            'is_practitioner' => ['required', 'boolean'],
            'register_timing' => ['nullable', 'string', 'in:now,later'],
        ]);

        $isPractitioner = $validated['is_practitioner'];
        $registerTiming = $validated['register_timing'] ?? null;

        // Save practitioner answer
        OrganizationSetting::setValue('is_practitioner', $isPractitioner ? 'true' : 'false');

        // If user is a practitioner, register_timing is required
        if ($isPractitioner && ! $registerTiming) {
            return back()->withErrors(['register_timing' => 'Please select when you would like to register.']);
        }

        // Save timing if provided
        if ($registerTiming) {
            OrganizationSetting::setValue('practitioner_register_timing', $registerTiming);
        }

        Log::info('[ONBOARDING] Saved practitioner questions answers', [
            'tenant_id' => tenant('id'),
            'is_practitioner' => $isPractitioner,
            'register_timing' => $registerTiming,
        ]);

        if (! $isPractitioner) {
            // User is not a practitioner, complete onboarding
            OrganizationSetting::setValue('isOnboardingComplete', 'true');

            return redirect()->route('dashboard')
                ->with('success', 'Onboarding completed successfully!');
        }

        // User is a practitioner
        if ($registerTiming === 'later') {
            // User wants to register later, complete onboarding
            OrganizationSetting::setValue('isOnboardingComplete', 'true');

            return redirect()->route('dashboard')
                ->with('success', 'Onboarding completed successfully! You can register as a practitioner later from your dashboard.');
        }

        // User wants to register now, show registration form
        return redirect()->route('onboarding.practitioner.create');
    }

    /**
     * Show "Register now or later?" question (redirects to combined page)
     */
    public function showRegisterTiming()
    {
        // Redirect to combined questions page
        return redirect()->route('onboarding.practitioner.questions');
    }

    /**
     * Save register timing preference (redirects to combined submission)
     */
    public function saveRegisterTiming(Request $request)
    {
        // Redirect to combined questions page - this method is kept for backward compatibility
        return redirect()->route('onboarding.practitioner.questions');
    }

    /**
     * Show practitioner registration form (3-step form)
     */
    public function showCreateForm()
    {
        $practiceType = OrganizationSetting::getValue('practice_type', null);
        $isPractitioner = OrganizationSetting::getValue('is_practitioner', null);
        $registerTiming = OrganizationSetting::getValue('practitioner_register_timing', null);

        // Unified flow for solo and group practice: user must have answered "yes" and chosen "now"
        if ($practiceType !== 'solo' && $practiceType !== 'group') {
            return redirect()->route('onboarding.index');
        }

        if ($isPractitioner !== 'true' || $registerTiming !== 'now') {
            return redirect()->route('onboarding.index');
        }

        // Get current user's email
        $currentUser = Auth::user();
        $userEmail = $currentUser ? $currentUser->email : null;

        // Fetch practitioner consents from tenant database
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

        return Inertia::render('onboarding-practitioner-create', [
            'userEmail' => $userEmail,
            'consents' => $consents,
        ]);
    }

    /**
     * Store practitioner registration
     */
    public function store(Request $request)
    {
        $tenantId = tenant('id');
        $currentUser = Auth::user();

        // Check if tenant user already exists before validation
        $tenantUser = User::where('email', $currentUser->email)->first();
        $userExists = $tenantUser !== null;

        // Build validation rules conditionally
        $rules = [
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
            'consents_accepted' => ['required', 'accepted'],
        ];

        // Password is only required if tenant user doesn't exist
        if (! $userExists) {
            $rules['password'] = ['required', 'string', 'min:8', 'confirmed'];
        } else {
            $rules['password'] = ['nullable', 'string', 'min:8', 'confirmed'];
        }

        $validated = $request->validate($rules);

        DB::beginTransaction();

        try {
            // Create practitioner in central database
            $practitioner = null;
            tenancy()->central(function () use (&$practitioner, $validated, $currentUser) {
                // Generate unique slug
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
                    'email' => $currentUser->email,
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

                // Set slug directly
                $practitioner->slug = $slug;
                $practitioner->saveQuietly();

                Log::info('[ONBOARDING] Created practitioner in central database', [
                    'practitioner_id' => $practitioner->id,
                    'email' => $practitioner->email,
                    'slug' => $practitioner->slug,
                ]);
            });

            // Handle tenant user - only create if doesn't exist, never update password if exists
            if (! $tenantUser) {
                // Create tenant user if doesn't exist (requires password)
                $tenantUser = User::create([
                    'id' => $currentUser->id,
                    'name' => $validated['first_name'].' '.$validated['last_name'],
                    'email' => $currentUser->email,
                    'password' => Hash::make($validated['password']),
                    'email_verified_at' => now(),
                ]);

                Log::info('[ONBOARDING] Created tenant user for practitioner', [
                    'user_id' => $tenantUser->id,
                    'email' => $tenantUser->email,
                ]);
            } else {
                // User already exists - keep existing password, don't update it
                Log::info('[ONBOARDING] Tenant user already exists, keeping existing password', [
                    'user_id' => $tenantUser->id,
                    'email' => $tenantUser->email,
                ]);
            }

            // Link practitioner to user in central database
            tenancy()->central(function () use ($practitioner, $currentUser) {
                $practitioner->update(['user_id' => $currentUser->id]);
            });

            // Link practitioner to tenant in central database
            tenancy()->central(function () use ($tenantId, $practitioner) {
                DB::table('tenant_practitioners')->insert([
                    'tenant_id' => $tenantId,
                    'practitioner_id' => $practitioner->id,
                    'invitation_status' => 'ACCEPTED',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            // Create tenant_user relationship in central database if doesn't exist
            tenancy()->central(function () use ($currentUser, $tenantId) {
                $existingTenantUser = DB::table('tenant_user')
                    ->where('user_id', $currentUser->id)
                    ->where('tenant_id', $tenantId)
                    ->first();

                if (! $existingTenantUser) {
                    DB::table('tenant_user')->insert([
                        'user_id' => $currentUser->id,
                        'tenant_id' => $tenantId,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            });

            DB::commit();

            // Sync practitioner to tenant database
            $this->syncPractitionerToTenant($practitioner, $tenantId);

            // Create all required consent records
            $this->createAllRequiredConsents($practitioner);

            // Assign Practitioner role to tenant user
            $practitionerRole = \Spatie\Permission\Models\Role::where('name', 'Practitioner')->first();
            if ($practitionerRole && ! $tenantUser->hasRole('Practitioner')) {
                $tenantUser->assignRole($practitionerRole);
            }

            // Store practitioner_user_id in OrganizationSettings
            OrganizationSetting::setValue('practitioner_user_id', (string) $tenantUser->id);
            OrganizationSetting::setValue('is_practitioner', 'true');

            // Don't mark onboarding complete yet - let OnboardingController check availability first
            Log::info('[ONBOARDING] Practitioner registration completed', [
                'tenant_id' => $tenantId,
                'practitioner_id' => $practitioner->id,
                'user_id' => $tenantUser->id,
            ]);

            // Redirect to onboarding index to check if availability needs to be set
            return redirect()->route('onboarding.index')
                ->with('success', 'Practitioner registration completed successfully! Please set your availability.');

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[ONBOARDING] Failed to register practitioner', [
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->withErrors(['error' => 'An error occurred while processing your registration. Please try again.'])->withInput();
        }
    }

    /**
     * Sync practitioner from central database to tenant database
     */
    private function syncPractitionerToTenant($centralPractitioner, $tenantId): void
    {
        try {
            // Sync practitioner data to tenant database
            $tenantPractitioner = \App\Models\Practitioner::syncFromCentral($centralPractitioner);

            Log::info('[ONBOARDING] Practitioner synced to tenant database', [
                'central_practitioner_id' => $centralPractitioner->id,
                'tenant_practitioner_id' => $tenantPractitioner->id,
                'tenant_id' => $tenantId,
            ]);

        } catch (\Exception $e) {
            Log::error('[ONBOARDING] Failed to sync practitioner to tenant database', [
                'central_practitioner_id' => $centralPractitioner->id,
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Create all required consent records for practitioner
     */
    private function createAllRequiredConsents($practitioner): void
    {
        try {
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
                    }
                }
            }

            Log::info('[ONBOARDING] All required consents created for practitioner', [
                'practitioner_id' => $practitioner->id,
                'total_consents' => $requiredConsents->count(),
            ]);

        } catch (\Exception $e) {
            Log::error('[ONBOARDING] Failed to create required consents for practitioner', [
                'practitioner_id' => $practitioner->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Check if current user is admin+practitioner (multi-role)
     */
    private function isUserAdminPlusPractitioner(): bool
    {
        $user = Auth::user();
        if (! $user) {
            return false;
        }

        // Check if user has Admin/Staff role
        $hasAdminRole = $user->hasRole(['Admin', 'Staff']);

        // Check if user has practitioner record in central database
        $hasPractitionerRecord = tenancy()->central(function () use ($user) {
            return \App\Models\Practitioner::where('user_id', $user->id)->exists();
        });

        return $hasAdminRole && $hasPractitionerRecord;
    }
}
