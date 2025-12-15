<?php

namespace App\Http\Middleware;

use App\Models\OrganizationSetting;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $isCentral = tenant('id') === null;

        $centralAppUrl = config('app.url');

        // Explicitly add port 8000 for local development if missing, as per user's request.
        // This overrides the .env setting for consistent local URL generation.
        if ($centralAppUrl === 'http://localhost') {
            $centralAppUrl .= ':8000';
        }

        $appearanceSettings = null;
        $computedTenantName = null;
        if (! $isCentral) {
            // Try practice details name from settings
            // (assuming OrganizationSetting::getByPrefix returns key=>value for this tenant)
            $practiceDetails = OrganizationSetting::getByPrefix('practice_details_');
            $practiceName = $practiceDetails['practice_details_name'] ?? null;

            // Fallback to company_name (keep your existing title-casing)
            $companyName = tenant('company_name') ? Str::title(tenant('company_name')) : null;

            $computedTenantName = $practiceName ?: $companyName;
        }

        // Get central user ID for practitioner/patient checks (works in both tenant and central context)
        $centralUserId = null;
        if ($request->user()) {
            $userEmail = $request->user()->email;
            $centralUser = tenancy()->central(function () use ($userEmail) {
                return \App\Models\User::where('email', $userEmail)->first();
            });
            $centralUserId = $centralUser?->id;
        }

        // Check if user has Keycloak session (even if not authenticated in Laravel)
        // This allows showing Keycloak user menu on login page
        // NOTE: We can only check for Laravel-stored tokens here.
        // Keycloak's own session status cannot be checked server-side without making an OAuth request.
        // The frontend component will handle checking Keycloak session via API call.
        $keycloakLoggedIn = false;
        $keycloakUserInfo = null;
        $keycloakAccessToken = session('keycloak_access_token');
        
        if ($keycloakAccessToken) {
            try {
                $keycloakService = app(\App\Services\KeycloakService::class);
                $userInfo = $keycloakService->getUserInfo($keycloakAccessToken);
                if ($userInfo) {
                    $keycloakLoggedIn = true;
                    $userName = trim(($userInfo['given_name'] ?? '') . ' ' . ($userInfo['family_name'] ?? '')) ?: ($userInfo['name'] ?? 'User');
                    $userEmail = $userInfo['email'] ?? null;
                    
                    // If Laravel user exists, prefer Laravel user name/email as fallback
                    if ($request->user()) {
                        $userName = $userName ?: $request->user()->name;
                        $userEmail = $userEmail ?: $request->user()->email;
                    }
                    
                    $keycloakUserInfo = [
                        'name' => $userName,
                        'email' => $userEmail,
                    ];
                } else {
                    // Token invalid, clear it
                    session()->forget('keycloak_access_token');
                    session()->forget('keycloak_refresh_token');
                }
            } catch (\Exception $e) {
                // Log error for debugging
                \Illuminate\Support\Facades\Log::warning('Keycloak user info check failed', [
                    'error' => $e->getMessage(),
                    'has_token' => !empty($keycloakAccessToken),
                ]);
                // Clear invalid token from session
                session()->forget('keycloak_access_token');
                session()->forget('keycloak_refresh_token');
            }
        }
        
        // IMPORTANT: We cannot check Keycloak's own session status server-side
        // without making an OAuth request. Keycloak session exists independently
        // of Laravel session. The frontend component will check via API call.

        $sharedData = [
            ...parent::share($request),
            'name' => config('app.name'),
            'appEnv' => config('app.env'),
            'csrf_token' => csrf_token(),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'centralAppUrl' => $centralAppUrl, // Expose central app URL to frontend
            'keycloak' => [
                'logged_in' => $keycloakLoggedIn,
                'user' => $keycloakUserInfo,
                'base_url' => config('keycloak.base_url'),
                'realm' => config('keycloak.realm'),
                'client_id' => config('keycloak.client_id'),
                'account_management_url' => $keycloakLoggedIn 
                    ? config('keycloak.base_url') . '/realms/' . config('keycloak.realm') . '/account'
                    : null,
            ],
            'auth' => [
                'user' => $request->user()
                    ? array_merge(
                        $request->user()->only('id', 'name', 'email'),
                        [
                            'roles' => $request->user()->getRoleNames(),
                            'permissions' => config('app.is_developer', false)
                                ? \Spatie\Permission\Models\Permission::all()->pluck('name')->all()
                                : $request->user()->getAllPermissions()->pluck('name')->all(),
                            'is_practitioner' => (function () use ($centralUserId, $request, $isCentral) {
                                // Check central database for practitioner record
                                $hasCentralPractitioner = $centralUserId
                                    ? tenancy()->central(function () use ($centralUserId) {
                                        return \App\Models\Practitioner::where('user_id', $centralUserId)->exists();
                                    })
                                    : false;

                                // Check tenant database for practitioner record (only in tenant context)
                                $hasTenantPractitioner = ! $isCentral && $request->user()
                                    ? \App\Models\Practitioner::where('user_id', $request->user()->id)->exists()
                                    : false;

                                return $hasCentralPractitioner || $hasTenantPractitioner;
                            })(),
                            'is_patient' => (function () use ($centralUserId, $request, $isCentral) {
                                // Check central database for patient record
                                $hasCentralPatient = $centralUserId
                                    ? tenancy()->central(function () use ($centralUserId) {
                                        return \App\Models\Patient::where('user_id', $centralUserId)->exists();
                                    })
                                    : false;

                                // Check tenant database for patient record (only in tenant context)
                                $hasTenantPatient = ! $isCentral && $request->user()
                                    ? \App\Models\Tenant\Patient::where('user_id', $request->user()->id)->exists()
                                    : false;

                                return $hasCentralPatient || $hasTenantPatient;
                            })(),
                            // Tenant-specific checks (only in tenant context)
                            'is_tenant_practitioner' => ! $isCentral && $request->user()
                                ? \App\Models\Practitioner::where('user_id', $request->user()->id)->exists()
                                : false,
                            'is_tenant_patient' => ! $isCentral && $request->user()
                                ? \App\Models\Tenant\Patient::where('user_id', $request->user()->id)->exists()
                                : false,
                            'is_onboarding' => $isCentral
                                 ? ((int) (
                                     data_get(\App\Models\Practitioner::where('user_id', $request->user()->id)->first(), 'meta_data.is_onboarding')
                                     ?? data_get(\App\Models\Patient::where('user_id', $request->user()->id)->first(), 'meta_data.is_onboarding')
                                     ?? data_get($request->user(), 'meta_data.is_onboarding')
                                     ?? 0
                                 ) === 1)
                                 : tenancy()->central(fn () => ((int) (
                                     data_get(\App\Models\Practitioner::where('user_id', $request->user()->id)->first(), 'meta_data.is_onboarding')
                                     ?? data_get(\App\Models\Patient::where('user_id', $request->user()->id)->first(), 'meta_data.is_onboarding')
                                     ?? data_get($request->user(), 'meta_data.is_onboarding')
                                     ?? 0
                                 ) === 1)),

                            'google2fa_enabled' => (bool) $request->user()->google2fa_enabled,
                            'user_role' => $isCentral ? null : determineUserRole(),
                            'tenancy' => [
                                'is_central' => $isCentral,
                                'current' => [
                                    'id' => tenant('id'),
                                    'name' => tenant('company_name') ? Str::title(tenant('company_name')) : null,
                                    'is_onboarding' => \App\Models\OrganizationSetting::getValue('isOnboardingComplete', 'false') !== 'true',
                                ],
                                'logo' => null, // Add logo to user object if available
                            ],
                            'tenants' => $request->user()
                                ? (function () use ($request, $isCentral) {
                                    // Get the user's email (works in both tenant and central context)
                                    $userEmail = $request->user()->email;

                                    // Find the central user by email to get the central user ID
                                    $centralUser = tenancy()->central(function () use ($userEmail) {
                                        return \App\Models\User::where('email', $userEmail)->first();
                                    });

                                    if (! $centralUser) {
                                        return [];
                                    }

                                    $centralUserId = $centralUser->id;

                                    // Check if user is a practitioner or patient (for invitation status)
                                    $isPractitioner = $isCentral
                                        ? \App\Models\Practitioner::where('user_id', $centralUserId)->exists()
                                        : tenancy()->central(function () use ($centralUserId) {
                                            return \App\Models\Practitioner::where('user_id', $centralUserId)->exists();
                                        });

                                    $isPatient = $isCentral
                                        ? \App\Models\Patient::where('user_id', $centralUserId)->exists()
                                        : tenancy()->central(function () use ($centralUserId) {
                                            return \App\Models\Patient::where('user_id', $centralUserId)->exists();
                                        });

                                    // Query tenant_user pivot table directly to get all tenants for this central user
                                    $tenantIds = tenancy()->central(function () use ($centralUserId) {
                                        return \Illuminate\Support\Facades\DB::table('tenant_user')
                                            ->where('user_id', $centralUserId)
                                            ->pluck('tenant_id')
                                            ->toArray();
                                    });

                                    // Get practitioner tenants from tenant_practitioners table
                                    $practitionerTenantIds = [];
                                    $centralPractitioner = tenancy()->central(function () use ($centralUserId) {
                                        return \App\Models\Practitioner::where('user_id', $centralUserId)->first();
                                    });

                                    if ($centralPractitioner) {
                                        $practitionerTenantIds = tenancy()->central(function () use ($centralPractitioner) {
                                            return \Illuminate\Support\Facades\DB::table('tenant_practitioners')
                                                ->where('practitioner_id', $centralPractitioner->id)
                                                ->pluck('tenant_id')
                                                ->toArray();
                                        });
                                    }

                                    // Get patient tenants from tenant_patients table
                                    $patientTenantIds = [];
                                    $centralPatient = tenancy()->central(function () use ($centralUserId) {
                                        return \App\Models\Patient::where('user_id', $centralUserId)->first();
                                    });

                                    if ($centralPatient) {
                                        $patientTenantIds = tenancy()->central(function () use ($centralPatient) {
                                            return \Illuminate\Support\Facades\DB::table('tenant_patients')
                                                ->where('patient_id', $centralPatient->id)
                                                ->pluck('tenant_id')
                                                ->toArray();
                                        });
                                    }

                                    // Merge all tenant IDs and remove duplicates
                                    $allTenantIds = array_unique(array_merge($tenantIds, $practitionerTenantIds, $patientTenantIds));

                                    if (empty($allTenantIds)) {
                                        return [];
                                    }

                                    // Load tenant details with domains
                                    return tenancy()->central(function () use ($allTenantIds, $isPatient, $centralPatient) {
                                        $tenants = \App\Models\Tenant::whereIn('id', $allTenantIds)
                                            ->with('domains')
                                            ->get();

                                        return $tenants->map(function ($tenant) use ($isPatient, $centralPatient) {
                                            $tenantData = [
                                                'id' => $tenant->id,
                                                'name' => $tenant->company_name ?? Str::title($tenant->id),
                                                'domain' => $tenant->domains->first()->domain ?? 'localhost',
                                                'invitation_status' => null,
                                            ];

                                            // For patients, add invitation status
                                            if ($isPatient && $centralPatient) {
                                                $invitationStatus = \Illuminate\Support\Facades\DB::table('tenant_patients')
                                                    ->where('patient_id', $centralPatient->id)
                                                    ->where('tenant_id', $tenant->id)
                                                    ->value('invitation_status');
                                                $tenantData['invitation_status'] = $invitationStatus;
                                            }

                                            return $tenantData;
                                        });
                                    });
                                })()
                                : null,
                        ]
                    )
                    : null,
            ],
            'tenancy' => [
                'is_central' => $isCentral,
                'current' => [
                    'id' => tenant('id'),
                    'name' => $computedTenantName,
                    'is_onboarding' => \App\Models\OrganizationSetting::getValue('isOnboardingComplete', 'false') !== 'true',
                    'is_onboarding_settings' => tenant('is_onboarding_settings') ?? false,
                ],
                'logo' => null,
            ],
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];

        if (! $isCentral && $request->user()) {
            $appearanceSettings = OrganizationSetting::getByPrefix('appearance_');

            // Use the key WITH prefix to match SettingsController approach
            $logoS3Key = $appearanceSettings['appearance_logo_s3_key'] ?? null;

            if (! empty($logoS3Key)) {
                try {
                    // Use proxy route to avoid CORS issues with cache-busting parameter
                    $tenantId = tenant('id');
                    $cacheBuster = substr(md5($logoS3Key), 0, 8); // Use S3 key hash for cache busting
                    $appearanceSettings['appearance_logo_path'] = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
                } catch (\Exception $e) {
                    $appearanceSettings['appearance_logo_path'] = null;
                }
            } else {
                $appearanceSettings['appearance_logo_path'] = null;
            }

            // Add logo to tenancy data for global access
            if (isset($sharedData['auth']['user']['tenancy'])) {
                $sharedData['auth']['user']['tenancy']['logo'] = $appearanceSettings['appearance_logo_path'] ?? null;
            }

            // Share organizationSettings globally for all authenticated tenant users
            $sharedData['organizationSettings'] = [
                'appearance' => $appearanceSettings,
                'timeLocale' => OrganizationSetting::getByPrefix('time_locale_'),
                'accounting' => OrganizationSetting::getAccountingSettings(),
            ];

            $sharedData['tenancy']['logo'] = $appearanceSettings['appearance_logo_path'] ?? null;
        } else {
            $sharedData['tenancy']['logo'] = null;
        }

        // Add onboarding status globally so all pages have access to it
        $sharedData['onboardingStatus'] = $this->getOnboardingStatus();

        // Add practice questionnaire data if in tenant context
        if (! $isCentral) {
            $sharedData['practiceType'] = OrganizationSetting::getValue('practice_type', null);
            $sharedData['appointmentType'] = OrganizationSetting::getValue('appointment_type', null);
            $hasMultipleLocationsValue = OrganizationSetting::getValue('has_multiple_locations', null);
            $sharedData['hasMultipleLocations'] = $hasMultipleLocationsValue === 'true' || $hasMultipleLocationsValue === true;
        } else {
            $sharedData['practiceType'] = null;
            $sharedData['appointmentType'] = null;
            $sharedData['hasMultipleLocations'] = null;
        }

        return $sharedData;
    }

    /**
     * Get the onboarding status for the current tenant.
     */
    protected function getOnboardingStatus(): array
    {
        // Only calculate for tenant context (not central)
        if (! tenant()) {
            return [
                'hasLocation' => true,
                'hasService' => true,
                'locationCount' => 0,
                'serviceCount' => 0,
                'isComplete' => true,
            ];
        }

        // Count only non-virtual locations for onboarding status
        $locationCount = \App\Models\Location::where('name', '!=', 'Virtual')->count();
        $allLocationCount = \App\Models\Location::count(); // Total count including virtual
        $serviceCount = \App\Models\Service::count();

        // Check if virtual location exists and has practitioner availability
        $virtualLocation = \App\Models\Location::where('name', 'Virtual')->first();
        $hasVirtualLocationWithHours = false;
        if ($virtualLocation) {
            $hasVirtualLocationWithHours = \App\Models\PractitionerAvailability::where('location_id', $virtualLocation->id)
                ->exists();
        }

        // Check isOnboardingComplete from OrganizationSettings
        $isOnboardingComplete = \App\Models\OrganizationSetting::getValue('isOnboardingComplete', 'false');
        $isOnboardingFlagBool = $isOnboardingComplete === 'true';

        // Get appointment type to determine required steps (practice type already retrieved above)
        $appointmentType = \App\Models\OrganizationSetting::getValue('appointment_type', null);
        $hasMultipleLocationsValue = \App\Models\OrganizationSetting::getValue('has_multiple_locations', null);
        $hasMultipleLocations = $hasMultipleLocationsValue === 'true' || $hasMultipleLocationsValue === true;

        $onboardingStatus = [
            'hasLocation' => $locationCount > 0,
            'hasService' => $serviceCount > 0,
        ];

        // Determine required steps based on questionnaire answers
        $requiredSteps = [];
        if ($appointmentType !== 'virtual') {
            $requiredSteps[] = 'location';
        }
        $requiredSteps[] = 'service';

        // Check if all required steps are completed
        // If isOnboardingComplete is true, onboarding is complete (trust the flag)
        // Otherwise, check if all required steps are completed
        if ($isOnboardingFlagBool) {
            // If flag is true, onboarding is complete
            $hasCompletedOnboarding = true;
        } else {
            // Check if all required steps are completed
            $hasCompletedOnboarding = true;
            foreach ($requiredSteps as $step) {
                switch ($step) {
                    case 'location':
                        if (! ($onboardingStatus['hasLocation'] ?? false)) {
                            $hasCompletedOnboarding = false;
                            break;
                        }
                        break;
                    case 'service':
                        if (! ($onboardingStatus['hasService'] ?? false)) {
                            $hasCompletedOnboarding = false;
                            break;
                        }
                        break;
                }
            }
        }

        \Illuminate\Support\Facades\Log::info('[MIDDLEWARE] Onboarding status calculated:', [
            'tenant_id' => tenant('id'),
            'appointmentType' => $appointmentType,
            'hasMultipleLocations' => $hasMultipleLocations,
            'locationCount' => $locationCount,
            'allLocationCount' => $allLocationCount,
            'serviceCount' => $serviceCount,
            'hasVirtualLocationWithHours' => $hasVirtualLocationWithHours,
            'isOnboardingComplete' => $isOnboardingComplete,
            'isOnboardingComplete_bool' => $isOnboardingFlagBool,
            'requiredSteps' => $requiredSteps,
            'onboardingStatus' => $onboardingStatus,
            'hasCompletedOnboarding' => $hasCompletedOnboarding,
        ]);

        return [
            'hasLocation' => $locationCount > 0, // Only non-virtual locations count
            'hasService' => $serviceCount > 0,
            'locationCount' => $locationCount, // Non-virtual count for onboarding
            'allLocationCount' => $allLocationCount, // Total count including virtual
            'serviceCount' => $serviceCount,
            'hasVirtualLocationWithHours' => $hasVirtualLocationWithHours,
            'isOnboarding' => $isOnboardingFlagBool,
            'isComplete' => $hasCompletedOnboarding,
        ];
    }
}
