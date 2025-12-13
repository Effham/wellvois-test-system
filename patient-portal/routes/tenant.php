<?php

declare(strict_types=1);

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\PractitionerDetailsController;
use App\Http\Controllers\PublicPortalController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Tenant\AppointmentController;
use App\Http\Controllers\Tenant\AttendanceController;
use App\Http\Controllers\Tenant\ConsentManagementController;
use App\Http\Controllers\Tenant\IntakeController;
use App\Http\Controllers\Tenant\InvoicesController;
use App\Http\Controllers\Tenant\LedgerController;
use App\Http\Controllers\Tenant\NoteController;
use App\Http\Controllers\Tenant\OnboardingController;
use App\Http\Controllers\Tenant\PatientConsentController;
use App\Http\Controllers\Tenant\PatientController;
use App\Http\Controllers\Tenant\PatientDashboardController;
use App\Http\Controllers\Tenant\PractitionerConsentController;
use App\Http\Controllers\Tenant\PractitionerController;
use App\Http\Controllers\Tenant\PractitionerDashboardController;
use App\Http\Controllers\Tenant\PublicPortalRegistrationController;
use App\Http\Controllers\Tenant\QuickBookAppointmentController;
use App\Http\Controllers\Tenant\ServiceController;
use App\Http\Controllers\Tenant\UserController as TenantUserController;
use App\Http\Controllers\Tenant\WaitingListController;
use App\Http\Controllers\Tenant\WalletController as TenantWalletApiController;
use App\Http\Controllers\WalletController;
use App\Http\Resources\PatientMinimalResource;
use App\Http\Resources\PractitionerResource;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

/*
|--------------------------------------------------------------------------
| Tenant Routes
|--------------------------------------------------------------------------
|
| Here you can register the tenant routes for your application.
| These routes are loaded by the TenantRouteServiceProvider.
|
| Feel free to customize them however you want. Good luck!
|
*/

// Patient portal is central-only - no tenant routes
// Tenant routes disabled for patient-portal
/*
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    // Route::get('/', function () {
    //     dd(\App\Models\User::all());
    //     return 'This is your multi-tenant application. The id of the current tenant is ' . tenant('id');
    // });

    // Secure SSO: Initial code reception (non-side-effecting GET)
    Route::get('/sso/start', function (Request $request) {
        $code = $request->query('code');

        if (! $code) {
            Log::warning('SSO start failed: Missing code parameter', [
                'tenant_id' => tenant('id'),
                'url' => $request->fullUrl(),
            ]);
            abort(400, 'Missing SSO code parameter');
        }

        Log::info('SSO start received', [
            'tenant_id' => tenant('id'),
            'code_length' => strlen($code),
        ]);

        // Perform code exchange directly using central database context
        $userData = null;
        $exchangeSuccessful = false;

        // Execute the exchange in central context to avoid HTTP calls
        tenancy()->central(function () use (&$userData, &$exchangeSuccessful, $code) {
            $ssoService = app(\App\Services\SecureSSOService::class);
            $userData = $ssoService->exchangeSSOCode(
                $code,
                session()->getId() // For session binding
            );
            $exchangeSuccessful = $userData !== null;
        });

        if (! $exchangeSuccessful || ! $userData) {
            Log::warning('SSO code exchange failed', [
                'tenant_id' => tenant('id'),
                'code_length' => strlen($code),
            ]);
            abort(403, 'SSO authentication failed');
        }

        // Create or get tenant user based on central user data
        $centralUserId = $userData['user_id'];
        $userEmail = $userData['user_email'];
        $redirectPath = $userData['redirect_internal'] ?? '/dashboard';

        // Get central user data for creating/updating tenant user
        $centralUser = null;
        tenancy()->central(function () use (&$centralUser, $centralUserId) {
            $centralUser = \App\Models\User::find($centralUserId);
        });

        if (! $centralUser) {
            Log::error('SSO failed: Central user not found', [
                'central_user_id' => $centralUserId,
                'tenant_id' => tenant('id'),
            ]);
            abort(403, 'User authentication failed');
        }

        // 🔒 CRITICAL SECURITY CHECK: Verify 2FA if enabled for central user
        $twoFactorPassed = $userData['2fa_passed'] ?? false;

        if ($centralUser->google2fa_enabled && ! $twoFactorPassed) {
            Log::warning('SSO blocked: 2FA required but not passed', [
                'central_user_id' => $centralUserId,
                'user_email' => $userEmail,
                'tenant_id' => tenant('id'),
                '2fa_enabled' => $centralUser->google2fa_enabled,
                '2fa_passed' => $twoFactorPassed,
            ]);

            // Invalidate the SSO code to prevent reuse
            tenancy()->central(function () {
                $ssoService = app(\App\Services\SecureSSOService::class);
                // The code was already exchanged, so it's already invalidated
            });

            // Redirect back to central login (NOT 2FA challenge to avoid loop)
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $protocol = app()->environment('production') ? 'https' : 'http';
            $port = app()->environment('production') ? '' : ':8000';
            $centralUrl = "{$protocol}://{$centralDomain}{$port}/login";

            return Inertia::location($centralUrl);
        }

        // Create or update tenant user
        $user = User::firstOrCreate(
            ['email' => $userEmail],
            [
                'name' => $centralUser->name,
                'email' => $centralUser->email,
                'email_verified_at' => $centralUser->email_verified_at,
                'password' => $centralUser->password,
            ]
        );

        // Assign appropriate role based on central user type
        $isPatient = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Patient::where('user_id', $centralUserId)->exists();
        });

        if ($isPatient && ! $user->hasRole('Patient')) {
            $user->assignRole('Patient');
        }

        // Create tenant session only after successful exchange
        Auth::login($user);

        // Store login timestamp for absolute session timeout enforcement
        session(['login_time' => now()->timestamp]);

        // Restore document_ids_filter if present in SSO data
        if (! empty($userData['document_ids_filter'])) {
            session(['document_ids_filter' => $userData['document_ids_filter']]);
            Log::info('📄 Document IDs restored from SSO to tenant session', [
                'document_ids' => $userData['document_ids_filter'],
                'user_id' => $user->id,
                'tenant_id' => tenant('id'),
            ]);
        }

        Log::info('SSO authentication successful', [
            'central_user_id' => $centralUserId,
            'tenant_user_id' => $user->id,
            'email' => $userEmail,
            'tenant_id' => tenant('id'),
            '2fa_passed' => $twoFactorPassed,
        ]);

        // Redirect to the intended path
        if (! str_starts_with($redirectPath, '/')) {
            $redirectPath = '/dashboard';
        }

        return Inertia::location(url($redirectPath));

    })->name('tenant.sso.start');

    // Backward compatibility route for old /sso/login URLs
    Route::get('/sso/login', function (Request $request) {
        Log::info('Legacy SSO login detected, converting to secure flow', [
            'tenant_id' => tenant('id'),
            'url' => $request->fullUrl(),
            'user_agent' => $request->userAgent(),
        ]);

        // Extract parameters from the old URL
        $email = $request->get('email');
        $centralUserId = $request->get('central_user_id');
        $redirectPath = $request->get('redirect', '/dashboard');
        $sessionKey = $request->get('session_key');
        $token = $request->get('token');
        $expires = $request->get('expires');

        // Validate basic required parameters
        if (! $email || ! $centralUserId || ! $token) {
            Log::warning('Legacy SSO missing required parameters', [
                'email' => $email,
                'central_user_id' => $centralUserId,
                'has_token' => ! empty($token),
                'tenant_id' => tenant('id'),
            ]);
            abort(400, 'Missing required SSO parameters');
        }

        // Check if the old token has expired
        if ($expires && now()->timestamp > $expires) {
            Log::warning('Legacy SSO token expired', [
                'expires' => $expires,
                'current_time' => now()->timestamp,
                'tenant_id' => tenant('id'),
            ]);
            abort(403, 'SSO link has expired');
        }

        // Find user by email in central database and create/update tenant user
        $centralUser = null;
        tenancy()->central(function () use (&$centralUser, $centralUserId) {
            $centralUser = \App\Models\User::find($centralUserId);
        });

        if (! $centralUser) {
            Log::error('Legacy SSO: Central user not found', [
                'central_user_id' => $centralUserId,
                'tenant_id' => tenant('id'),
            ]);
            abort(403, 'User authentication failed');
        }

        // Create or update tenant user (same logic as secure flow)
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $centralUser->name,
                'email' => $centralUser->email,
                'email_verified_at' => $centralUser->email_verified_at,
                'password' => $centralUser->password,
            ]
        );

        // Assign role if needed
        $isPatient = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Patient::where('user_id', $centralUserId)->exists();
        });

        if ($isPatient && ! $user->hasRole('Patient')) {
            $user->assignRole('Patient');
        }

        // Validate session key if provided (for tenant switching compatibility)
        if ($sessionKey) {
            $tenantSessionService = app(\App\Services\TenantSessionService::class);
            if ($tenantSessionService->validateTenantSwitch($sessionKey, $centralUserId, tenant('id'), $token)) {
                $redirectPath = $tenantSessionService->getRedirectPath($sessionKey);
                $tenantSessionService->cleanupTenantSwitch($sessionKey);
            }
        }

        // Create session and redirect
        Auth::login($user);

        // Store login timestamp for absolute session timeout enforcement
        session(['login_time' => now()->timestamp]);

        Log::info('Legacy SSO authentication successful', [
            'central_user_id' => $centralUserId,
            'tenant_user_id' => $user->id,
            'email' => $email,
            'tenant_id' => tenant('id'),
        ]);

        // Redirect to intended path
        if (! str_starts_with($redirectPath, '/')) {
            $redirectPath = '/dashboard';
        }

        return Inertia::location(url($redirectPath));

    })->name('tenant.sso.login.legacy');

    // Route to switch from tenant back to central
    Route::get('/switch-to-central', function () {
        $user = Auth::user();

        // Check practitioner/patient records (central + tenant-level)
        $hasPractitionerRecord = userHasPractitionerRecord($user);
        $hasPatientRecord = userHasPatientRecord($user);

        $protocol = app()->environment('production') ? 'https' : 'http';
        $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
        $centralUrl = "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '');

        // Redirect based on table records
        if ($hasPractitionerRecord && $hasPatientRecord) {
            // Both records → Default to practitioner dashboard
            return Inertia::location($centralUrl.'/central/practitioner-dashboard');
        } elseif ($hasPractitionerRecord) {
            return Inertia::location($centralUrl.'/central/practitioner-dashboard');
        } elseif ($hasPatientRecord) {
            return Inertia::location($centralUrl.'/central/patient-dashboard');
        }

        // No records → Redirect to dashboard (will show tenant selection/admin dashboard)
        return Inertia::location($centralUrl.'/dashboard');
    })->name('tenant.switch-to-central');

    // Secure tenant-to-tenant switching
    Route::post('/switch-to-tenant', function (Request $request) {
        $user = Auth::user();
        $tenantId = $request->tenant_id;
        $redirectPath = $request->get('redirect', '/dashboard');

        // Get central user for verification
        $centralUser = null;
        tenancy()->central(function () use (&$centralUser, $user) {
            $centralUser = \App\Models\User::where('email', $user->email)->first();
        });

        if (! $centralUser) {
            abort(403, 'Central user not found.');
        }

        // Get target tenant
        $tenant = null;
        tenancy()->central(function () use (&$tenant, $tenantId) {
            $tenant = \App\Models\Tenant::with('domains')->find($tenantId);
        });

        if (! $tenant) {
            abort(404, 'Target tenant not found.');
        }

        // Generate secure one-time code for tenant switch
        $ssoService = null;
        tenancy()->central(function () use (&$ssoService, $centralUser, $tenant, $redirectPath) {
            $ssoService = app(\App\Services\SecureSSOService::class);
            $code = $ssoService->generateSSOCode($centralUser, $tenant, $redirectPath);
            $ssoUrl = $ssoService->generateTenantSSOUrl($code, $tenant);
            $ssoService = $ssoUrl; // Store the URL in the variable
        });

        return Inertia::location($ssoService);
    })->name('tenant.switch-to-tenant');

    // API endpoint for real-time patient invitation statuses

    Route::get('/', function () {
        return redirect()->route('login.intent');
    })->name('home');

    // Patient Dashboard Route - Accessible without auth for public portal auto-login
    // Important: keep guest access here to allow cookie-based auto-login
    Route::get('patient-dashboard', [PatientDashboardController::class, 'index'])
        ->name('patient-dashboard.index');

    // Public consent endpoints (no auth required - for public portal registration)
    Route::post('/patient/pending-consents', [\App\Http\Controllers\PatientConsentController::class, 'getPendingConsents'])
        ->name('patient.pending-consents')
        ->withoutMiddleware(['auth', 'verified', 'can-access-tenant']);

    Route::post('/consents/accept-all', [\App\Http\Controllers\PatientConsentController::class, 'acceptAll'])
        ->name('consents.accept-all')
        ->withoutMiddleware(['auth', 'verified', 'can-access-tenant']);

    // Global logout route - accessible from any tenant (both GET and POST for fallback)
    Route::match(['get', 'post'], '/logout', function (Request $request) {
        try {
            $globalLogoutService = app(\App\Services\GlobalLogoutService::class);
            $globalLogoutService->performGlobalLogout($request);

            Log::info('Tenant logout successful', [
                'tenant_id' => tenant('id'),
                'method' => $request->method(),
                'user_agent' => $request->userAgent(),
            ]);

            // Check if logout is from public portal
            if ($request->has('from_public_portal') && $request->input('from_public_portal') === 'true') {
                return redirect()->route('public-portal.index');
            }

            // Default redirect to central login
            $protocol = app()->environment('production') ? 'https' : 'http';
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $redirectUrl = "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '').'/login';

            return redirect()->away($redirectUrl);

        } catch (\Exception $e) {
            Log::error('Logout error in tenant context', [
                'tenant_id' => tenant('id'),
                'error' => $e->getMessage(),
                'method' => $request->method(),
            ]);

            // Force logout even if there's an error
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // Redirect to central domain
            $protocol = app()->environment('production') ? 'https' : 'http';
            $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
            $redirectUrl = "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '').'/login';

            return redirect()->away($redirectUrl);
        }
    })->name('logout');

    Route::middleware(['auth', 'verified', 'can-access-tenant'])->group(function () {

        Route::get('dashboard', function () {
            $user = Auth::user();

            // PRIORITY ORDER: Admin/Staff > Patient (role or tenant record) > Practitioner (role or tenant record) > Default
            // Check if user has Admin or Staff role first (highest priority)
            if ($user && ($user->hasRole('Admin') || $user->hasRole('Staff'))) {
                // Admin/Staff users go to main dashboard (onboarding will be checked there)
                return Inertia::render('dashboard');
            }

            // Check if user has Patient role OR tenant patient record
            $hasPatientRole = $user && $user->hasRole('Patient');
            $hasTenantPatientRecord = $user && \App\Models\Tenant\Patient::where('user_id', $user->id)->exists();

            if ($hasPatientRole || $hasTenantPatientRecord) {
                return redirect()->route('patient-dashboard.index');
            }

            // Check if user has Practitioner role OR tenant practitioner record
            $hasPractitionerRole = $user && $user->hasRole('Practitioner');
            $hasTenantPractitionerRecord = $user && \App\Models\Practitioner::where('user_id', $user->id)->exists();

            if ($hasPractitionerRole || $hasTenantPractitionerRecord) {
                return redirect()->route('practitioner-dashboard');
            }

            // Default: main dashboard
            return Inertia::render('dashboard');
        })->name('dashboard');

        // Onboarding routes
        Route::prefix('onboarding')->name('onboarding.')->group(function () {
            Route::get('/', [OnboardingController::class, 'index'])->name('index');
            Route::get('/questionnaire', [OnboardingController::class, 'questionnaire'])->name('questionnaire');

            // Practitioner onboarding routes
            Route::prefix('practitioner')->name('practitioner.')->group(function () {
                Route::get('/questions', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'showQuestions'])->name('questions');
                Route::post('/questions', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'savePractitionerQuestion'])->name('questions.save');
                Route::get('/register-timing', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'showRegisterTiming'])->name('register-timing');
                Route::post('/register-timing', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'saveRegisterTiming'])->name('register-timing.save');
                Route::get('/create', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'showCreateForm'])->name('create');
                Route::post('/create', [\App\Http\Controllers\Tenant\PractitionerOnboardingController::class, 'store'])->name('store');
            });
        });

        // Complete onboarding route (controller-based, not API)
        Route::post('/complete-onboarding', [\App\Http\Controllers\Tenant\DashboardController::class, 'completeOnboarding'])
            ->name('complete-onboarding');

        // Check onboarding completion route
        Route::post('/onboarding/check-completion', [\App\Http\Controllers\Tenant\DashboardController::class, 'checkOnboardingCompletion'])
            ->name('onboarding.check-completion');

        // Save practice questionnaire route
        Route::post('/practice-questionnaire', [\App\Http\Controllers\Tenant\DashboardController::class, 'saveQuestionnaire'])
            ->name('practice-questionnaire');
        Route::post('/create-virtual-location', [\App\Http\Controllers\Tenant\DashboardController::class, 'createVirtualLocation'])
            ->name('create-virtual-location');

        // Attendance Management Routes
        Route::prefix('attendance')->name('attendance.')->group(function () {
            Route::get('status', [AttendanceController::class, 'getStatus'])->name('status');
            Route::post('clock-in', [AttendanceController::class, 'clockIn'])->name('clock-in');
            Route::post('clock-out', [AttendanceController::class, 'clockOut'])->name('clock-out');
            Route::get('history', [AttendanceController::class, 'history'])->name('history');
        });

        // Attendance Logs (admin view)
        Route::get('attendance-logs', [AttendanceController::class, 'index'])
            ->name('attendance-logs.index')
            ->middleware('permission:view-attendance');

        // Practitioner Dashboard Route - Accessible by users with Practitioner role OR tenant practitioner record
        Route::get('practitioner-dashboard', [PractitionerDashboardController::class, 'index'])
            ->name('practitioner-dashboard');

        // Practitioner Consents Routes - Accessible by users with Practitioner role OR tenant practitioner record
        Route::get('practitioner/consents', [PractitionerConsentController::class, 'index'])
            ->name('practitioner.consents.index');

        Route::post('practitioner/consents/accept-all', [PractitionerConsentController::class, 'acceptAll'])
            ->name('practitioner.consents.accept-all');

        Route::post('practitioner/consents/{consentVersion}/revoke', [PractitionerConsentController::class, 'revoke'])
            ->name('practitioner.consents.revoke');

        // Patient consent routes - Accessible by users with Patient role OR tenant patient record
        Route::prefix('consents')->name('patient.consents.')->group(function () {
            Route::get('/manage', [PatientConsentController::class, 'index'])->name('manage');
            Route::post('/accept-all', [PatientConsentController::class, 'acceptAll'])->name('accept-all');
            Route::post('/{consentVersion}/accept', [PatientConsentController::class, 'accept'])->name('accept');
            Route::post('/{consentVersion}/revoke', [PatientConsentController::class, 'revoke'])->name('revoke');
        });

        // Public consent acceptance (from email) - no auth required
        Route::get('consents/accept/{token}', [PatientConsentController::class, 'show'])->name('patient.consents.show');
        Route::post('consents/accept/{token}', [PatientConsentController::class, 'acceptFromEmail'])->name('patient.consents.accept-email');

        // API to complete onboarding
        Route::post('/api/complete-onboarding', function () {
            $currentTenantId = tenant('id');

            if ($currentTenantId) {
                // Use central connection to update the tenant model
                tenancy()->central(function () use ($currentTenantId) {
                    $tenant = Tenant::find($currentTenantId);
                    if ($tenant) {
                        Log::info('[API ONBOARDING] Updating tenant:', [
                            'tenant_id' => $tenant->id,
                            'is_onboarding_before' => $tenant->is_onboarding,
                        ]);

                        $tenant->update(['is_onboarding' => false]);
                        $tenant->refresh();

                        Log::info('[API ONBOARDING] After update:', [
                            'tenant_id' => $tenant->id,
                            'is_onboarding_after' => $tenant->is_onboarding,
                        ]);
                    }
                });

                return response()->json(['success' => true]);
            }

            return response()->json(['success' => false], 400);
        })->name('api.complete-onboarding');

        // API to complete settings onboarding
        Route::post('/api/complete-onboarding-settings', function () {
            $currentTenantId = tenant('id');

            if ($currentTenantId) {
                // Use central connection to update the tenant model
                tenancy()->central(function () use ($currentTenantId) {
                    $tenant = Tenant::find($currentTenantId);
                    if ($tenant) {
                        $tenant->update(['is_onboarding_settings' => 0]);
                    }
                });

                return response()->json(['success' => true]);
            }

            return response()->json(['success' => false], 400);
        })->name('api.complete-onboarding-settings');

        Route::resource('roles', RoleController::class);

        Route::get('users', [TenantUserController::class, 'index'])->name('users.index');
        Route::get('users/invite', [TenantUserController::class, 'create'])->name('users.invite');
        Route::resource('users', TenantUserController::class)->except(['index', 'show', 'create']);
        Route::get('users-archived', [TenantUserController::class, 'archived'])->name('users.archived');
        Route::post('users/{id}/restore', [TenantUserController::class, 'restore'])->name('users.restore');
        Route::delete('users/{id}/force-delete', [TenantUserController::class, 'forceDelete'])->name('users.force-delete');
        Route::patch('users/{user}/role', [TenantUserController::class, 'updateRole'])->name('users.updateRole');

        // User Invitations
        Route::get('users/invitations', [\App\Http\Controllers\Tenant\InvitationController::class, 'index'])->name('users.invitations.index');
        Route::post('users/invitations', [\App\Http\Controllers\Tenant\InvitationController::class, 'store'])->name('users.invitations.store');
        Route::post('users/invitations/{invitation}/resend', [\App\Http\Controllers\Tenant\InvitationController::class, 'resend'])->name('users.invitations.resend');

        // Invitation acceptance routes (public, no auth required)
        Route::get('users/invitations/accept/{token}', [\App\Http\Controllers\Tenant\InvitationController::class, 'show'])
            ->name('users.invitations.accept')
            ->withoutMiddleware(['auth', 'verified', 'can-access-tenant']);
        Route::post('users/invitations/accept/{token}', [\App\Http\Controllers\Tenant\InvitationController::class, 'accept'])
            ->name('users.invitations.accept.store')
            ->withoutMiddleware(['auth', 'verified', 'can-access-tenant']);

        Route::get('/public-portal-registrations', [PublicPortalRegistrationController::class, 'index'])
            ->name('public-portal-registrations.index')
            ->middleware('permission:view-intake-queue');

        // Patients listing with deferred loading support
        Route::get('patients', [PatientController::class, 'index'])->name('patients.index');

        Route::resource('patients', PatientController::class)->except(['index']);

        // Patient approval routes
        Route::post('patients/{patient}/approve', [App\Http\Controllers\Tenant\PatientApprovalController::class, 'approve'])
            ->name('patients.approve')
            ->middleware('permission:approve-patient-registration');

        Route::post('patients/{patient}/reject', [App\Http\Controllers\Tenant\PatientApprovalController::class, 'reject'])
            ->name('patients.reject')
            ->middleware('permission:approve-patient-registration');

        // Patient invitations with deferred loading support
        Route::get('patient-invitations', [PatientController::class, 'invitations'])->name('patients.invitations.index');

        Route::post('patients/validate-email', [PatientController::class, 'validateEmail'])->name('patients.validate-email');
        Route::post('patients/check-health-number', [PatientController::class, 'checkHealthNumber'])->name('patients.check-health-number');
        Route::post('patients/get-for-autofill', [PatientController::class, 'getPatientForAutofill'])->name('patients.get-for-autofill');
        Route::post('patients/search-by-email', [PatientController::class, 'searchByEmail'])->name('patients.search-by-email');
        Route::post('patients/search-by-name', [PatientController::class, 'searchByName'])->name('patients.search-by-name');

        // Patient medical history edit routes (admin) - uses PatientDashboardController
        Route::get('patients/{patient}/edit-medical-history', [PatientController::class, 'editMedicalHistory'])->name('patients.edit-medical-history');

        // Admin API routes to update patient medical history (uses existing service)
        Route::put('api/patients/{patient}/medical-history/family-medical-histories', [PatientController::class, 'adminUpdateFamilyMedicalHistories']);
        Route::put('api/patients/{patient}/medical-history/patient-medical-histories', [PatientController::class, 'adminUpdatePatientMedicalHistories']);
        Route::put('api/patients/{patient}/medical-history/known-allergies', [PatientController::class, 'adminUpdateKnownAllergies']);

        // Waiting List Routes
        Route::get('waiting-list', [WaitingListController::class, 'index'])->name('waiting-list.index');

        // Practitioner Routes
        // Static routes must come BEFORE resource routes to avoid conflicts
        Route::get('practitioners/invite-form', [PractitionerController::class, 'showInviteForm'])->name('practitioners.invite-form');
        Route::get('practitioners/invitations', [PractitionerController::class, 'invitations'])->name('practitioners.invitations');
        Route::post('practitioners/validate-email', [PractitionerController::class, 'validateEmail'])->name('practitioners.validate-email');
        Route::post('practitioners/search', [PractitionerController::class, 'searchPractitioners'])->name('practitioners.search');
        Route::post('practitioners/link', [PractitionerController::class, 'linkPractitioner'])->name('practitioners.link');
        Route::post('practitioners/basic-info', [PractitionerController::class, 'storeBasicInfo'])->name('practitioners.store-basic-info');
        Route::post('practitioners/professional-details', [PractitionerController::class, 'storeProfessionalDetails'])->name('practitioners.store-professional-details');
        Route::post('practitioners/combined-details', [PractitionerController::class, 'storeCombinedDetails'])->name('practitioners.store-combined-details');
        Route::post('practitioners/locations', [PractitionerController::class, 'storeLocations'])->name('practitioners.store-locations');
        Route::post('practitioners/pricing', [PractitionerController::class, 'storePricing'])->name('practitioners.store-pricing');
        Route::post('practitioners/invite-by-email', [PractitionerController::class, 'inviteByEmail'])->name('practitioners.invite-by-email');
        Route::post('practitioners/invitations/{invitation}/resend', [PractitionerController::class, 'resendInvitation'])->name('practitioners.invitations.resend');

        // Routes with practitioner parameter
        Route::get('practitioners/{practitioner}/locations', [PractitionerController::class, 'getLocations'])->name('practitioners.locations.get');
        Route::get('practitioners/{practitioner}/locations/{location}/availability', [PractitionerController::class, 'getLocationAvailability'])->name('practitioners.locations.availability.get');
        Route::post('practitioners/{practitioner}/locations/{location}/availability', [PractitionerController::class, 'storeLocationAvailability'])->name('practitioners.locations.availability.store');
        Route::get('practitioners/{practitioner}/services', [PractitionerController::class, 'getPractitionerServices'])->name('practitioners.services.get');
        Route::post('practitioners/{practitioner}/services', [PractitionerController::class, 'storePractitionerServices'])->name('practitioners.services.store');
        Route::post('practitioners/{practitioner}/invite', [PractitionerController::class, 'invite'])->name('practitioners.invite');

        // Practitioners list and invitations pages (using SettingsController for consistency)
        Route::get('practitioners/list', [\App\Http\Controllers\Settings\SettingsController::class, 'practitionersList'])->name('practitioners.list')->middleware('permission:view-practitioner');
        Route::get('practitioners/invitations-list', [\App\Http\Controllers\Settings\SettingsController::class, 'practitionersInvitations'])->name('practitioners.invitations-list')->middleware('permission:view-practitioner');

        // Resource route must come LAST to avoid conflicts with static routes
        Route::resource('practitioners', PractitionerController::class);

        // Patient invitation routes (similar to practitioner routes)
        Route::post('patients/{patient}/invite', [PatientController::class, 'invite'])->name('patients.invite');
        Route::post('patients/invitations/{invitation}/resend', [PatientController::class, 'resendInvitation'])->name('patients.invitations.resend');

        // Patient and Practitioner consent resend routes
        Route::post('patients/{patient}/resend-consent', [PatientController::class, 'resendConsent'])->name('patients.resend-consent');
        Route::post('practitioners/{practitioner}/resend-consent', [PractitionerController::class, 'resendConsent'])->name('practitioners.resend-consent');

        // Practitioner Details (for practitioners to edit their own information)
        Route::get('practitioner-details', [PractitionerDetailsController::class, 'index'])->name('practitioner-details.index');
        Route::post('practitioner-details', [PractitionerDetailsController::class, 'update'])->name('practitioner-details.update');

        Route::resource('services', ServiceController::class);
        Route::get('services-archived', [ServiceController::class, 'archived'])->name('services.archived');
        Route::post('services/{id}/restore', [ServiceController::class, 'restore'])->name('services.restore');
        Route::delete('services/{id}/force-delete', [ServiceController::class, 'forceDelete'])->name('services.force-delete');
        Route::get('onboarding/service/create', [ServiceController::class, 'onboardingCreate'])->name('onboarding.service.create');

        // Onboarding location routes
        Route::get('onboarding/location/create', [LocationController::class, 'onboardingCreate'])->name('onboarding.location.create');
        Route::post('locations/store-multiple', [LocationController::class, 'storeMultiple'])->name('locations.store-multiple');

        // Onboarding practitioner availability routes
        Route::get('onboarding/practitioner-availability', [\App\Http\Controllers\Tenant\OnboardingPractitionerAvailabilityController::class, 'index'])
            ->name('onboarding.practitioner-availability');
        Route::post('onboarding/practitioner-availability', [\App\Http\Controllers\Tenant\OnboardingPractitionerAvailabilityController::class, 'store'])
            ->name('onboarding.practitioner-availability.store');

        // Location Service Schedule (Mockup)
        Route::get('mockup/location', function () {
            return Inertia::render('LocationService/Index', [
                'locations' => [],
                'practitionerId' => 1,
            ]);
        })->name('mockup.location.index');

        // Location routes
        Route::resource('locations', LocationController::class);
        Route::get('locations-archived', [LocationController::class, 'archived'])->name('locations.archived');
        Route::post('locations/{id}/restore', [LocationController::class, 'restore'])->name('locations.restore');
        Route::delete('locations/{id}/force-delete', [LocationController::class, 'forceDelete'])->name('locations.force-delete');
        Route::get('locations/practitioners/all', [LocationController::class, 'getAllPractitioners'])->name('locations.practitioners.all');
        Route::post('locations/{location}/practitioners', [LocationController::class, 'updatePractitioners'])->name('locations.practitioners.update');
        Route::get('locations/{location}/practitioners', [LocationController::class, 'getPractitioners'])->name('locations.practitioners.get');

        //  Invoices

        Route::get('invoices/search-customers', [InvoicesController::class, 'searchCustomers'])->name('invoices.search-customers');
        Route::get('invoices/export', [InvoicesController::class, 'export'])->name('invoices.export');
        Route::resource('invoices', InvoicesController::class);
        Route::get('invoices-archived', [InvoicesController::class, 'archived'])->name('invoices.archived');
        Route::post('invoices/{id}/restore', [InvoicesController::class, 'restore'])->name('invoices.restore'); // use {id} so we can find trashed
        Route::delete('invoices/{id}/force-delete', [InvoicesController::class, 'forceDelete'])->name('invoices.force-delete');
        Route::get('invoices/{invoice}/transactions', [InvoicesController::class, 'transactions'])->name('invoices.transactions');
        Route::post('invoices/{invoice}/create-transaction', [InvoicesController::class, 'createTransaction'])->name('invoices.create-transaction');
        Route::post('invoices/{invoice}/send-email', [InvoicesController::class, 'sendEmail'])->name('invoices.send-email');
        Route::post('invoices/{invoice}/create-payout', [InvoicesController::class, 'createPayout'])->name('invoices.create-payout');

        // Accounting Ledger
        Route::get('ledger', [LedgerController::class, 'index'])->name('ledger.index');

        Route::prefix('appointments')->name('appointments.')->group(function () {
            Route::get('/', [AppointmentController::class, 'index'])->name('index');
            Route::get('/create', [AppointmentController::class, 'create'])->name('create');
            Route::post('/create', [AppointmentController::class, 'create'])->name('create.store'); // For form data storage
            Route::post('/store', [AppointmentController::class, 'store'])->name('store');

            // Quick booking from calendar
            Route::get('/quick-book', [QuickBookAppointmentController::class, 'create'])->name('quick-book');
            Route::post('/quick-book', [QuickBookAppointmentController::class, 'store'])->name('quick-book.store');

            // Patient booking routes
            Route::get('/patient-book', [AppointmentController::class, 'patientBook'])->name('patient-book');
            Route::post('/patient-store', [AppointmentController::class, 'patientStore'])->name('patient-store');

            // Appointment detail routes
            Route::get('/{appointment}', [AppointmentController::class, 'show'])->name('show');

            // Manage appointment - separate page instead of modal
            Route::get('/{appointment}/manage', [AppointmentController::class, 'showManageAppointment'])->name('manage');

            Route::patch('/{appointment}/status', [AppointmentController::class, 'updateStatus'])->name('updateStatus');
            Route::post('/{appointment}/approve-and-confirm', [AppointmentController::class, 'approveAndConfirm'])->name('approve-and-confirm');

            // DEBUG: Check requested appointments in database
            Route::get('/debug/requested-appointments', function () {
                $requestedAppointments = \App\Models\Tenant\Appointment::where('status', 'Requested')
                    ->with(['service:id,name', 'location:id,name'])
                    ->get();

                $appointmentsWithPatients = $requestedAppointments->map(function ($appointment) {
                    $patient = \App\Models\Tenant\Patient::find($appointment->patient_id);

                    return [
                        'appointment_id' => $appointment->id,
                        'status' => $appointment->status,
                        'patient_id' => $appointment->patient_id,
                        'patient_exists_in_tenant' => $patient ? 'YES' : 'NO',
                        'patient_name' => $patient ? $patient->first_name.' '.$patient->last_name : 'NULL',
                        'patient_email' => $patient ? $patient->email : 'NULL',
                        'patient_registration_status' => $patient ? $patient->registration_status : 'NULL',
                        'service' => $appointment->service?->name ?? 'NULL',
                        'appointment_datetime' => $appointment->appointment_datetime,
                        'created_at' => $appointment->created_at,
                    ];
                });

                return response()->json([
                    'total_requested_appointments' => $requestedAppointments->count(),
                    'appointments' => $appointmentsWithPatients,
                    'tenant_id' => tenant()->id,
                    'all_statuses' => \App\Models\Tenant\Appointment::select('status')->distinct()->pluck('status'),
                ]);
            })->name('debug.requested-appointments');

            Route::get('/{appointment}/manage-appointment', [AppointmentController::class, 'showManageAppointment'])->name('manageAppointment');
            Route::patch('/{appointment}/manage-appointment', [AppointmentController::class, 'updateManageAppointment'])->name('updateManageAppointment');

            // Patient search and lookup routes
            Route::post('/search', [AppointmentController::class, 'searchPatients'])->name('search');
            Route::post('/fill-patient', [AppointmentController::class, 'fillPatientData'])->name('fillPatient');
            Route::post('/lookup-patients', [AppointmentController::class, 'lookupPatients'])->name('lookupPatients');
            Route::post('/link-patient', [AppointmentController::class, 'linkPatient'])->name('linkPatient');
            Route::post('/practitioner-availability', [AppointmentController::class, 'getPractitionerAvailability'])->name('practitionerAvailability');
            Route::get('/{appointment}/session', [AppointmentController::class, 'showSession'])->name('session');
            Route::get('/{appointment}/ai-summary', [AppointmentController::class, 'showAISummary'])->name('ai-summary');
            Route::post('/{appointment}/send-ai-summary', [AppointmentController::class, 'sendAISummaryToPatient'])->name('send-ai-summary');
            Route::put('/{appointment}/update-ai-summary', [AppointmentController::class, 'updateAISummary'])->name('update-ai-summary');
            Route::post('/{appointment}/regenerate-ai-summary', [AppointmentController::class, 'regenerateAISummary'])->name('regenerate-ai-summary');
            Route::post('/{appointment}/generate-recording-ai-summary', [AppointmentController::class, 'generateRecordingAISummary'])->name('generate-recording-ai-summary');
            Route::post('/{appointment}/regenerate-recording-ai-summary', [AppointmentController::class, 'regenerateRecordingAISummary'])->name('regenerate-recording-ai-summary');
            Route::get('/{appointment}/recordings', [AppointmentController::class, 'showRecordings'])->name('recordings');
            Route::get('/{appointment}/history', [AppointmentController::class, 'getAppointmentHistory'])->name('history');
            Route::get('/{appointment}/feedback', [AppointmentController::class, 'showFeedback'])->name('feedback');
            Route::post('/{appointment}/feedback', [AppointmentController::class, 'storeFeedback'])->name('feedback.store');
            Route::post('/{appointment}/send-patient-link', [AppointmentController::class, 'sendPatientAppointmentLink'])->name('send-patient-link');
            Route::post('/{appointment}/send-invitation', [AppointmentController::class, 'sendInvitationLink'])->name('send-invitation');
            Route::post('/{appointment}/resend-consent', [AppointmentController::class, 'resendConsent'])->name('resend-consent');
            Route::post('/{appointment}/complete', function (App\Models\Tenant\Appointment $appointment) {
                $transactions = $appointment->markAsCompleted();

                return response()->json([
                    'message' => 'Appointment completed successfully',
                    'appointment' => $appointment->fresh(),
                    'transactions_created' => count($transactions),
                    'transactions' => $transactions,
                ]);
            })->name('complete');

            // ... other appointment routes
        });

        // Billing routes - must be in tenant context for Stripe operations
        Route::prefix('billing')->name('billing.')->group(function () {
            Route::post('/checkout', [\App\Http\Controllers\BillingController::class, 'createCheckoutSession'])->name('checkout');
            Route::get('/success', [\App\Http\Controllers\BillingController::class, 'success'])->name('success');
        });

        Route::get('/activity-logs', [ActivityLogController::class, 'index'])
            ->name('activity-logs.index');

        Route::get('/calendar', function (Request $request) {
            $user = Auth::user();

            // Check if user is a patient
            if ($user->hasRole('Patient')) {
                // Get patient from central database (encrypted field)
                $patient = tenancy()->central(function () use ($user) {
                    return \App\Models\Patient::whereBlind('email', 'email_index', $user->email)->first();
                });

                if (! $patient) {
                    abort(403, 'Access denied. Patient record not found.');
                }

                // Get patient's appointments in this tenant only
                $tenantAppointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
                    ->where('patient_id', $patient->id)
                    ->whereIn('status', ['confirmed', 'pending'])
                    ->whereNotNull('appointment_datetime')
                    ->orderBy('appointment_datetime', 'asc')
                    ->get();

                $appointments = [];
                foreach ($tenantAppointments as $appointment) {
                    // Get practitioners from central database
                    $practitioners = $appointment->getPractitionerData();
                    $practitionerName = $practitioners->isNotEmpty()
                        ? 'Dr. '.$practitioners->first()->first_name.' '.$practitioners->first()->last_name
                        : 'TBD';

                    $service = $appointment->service;
                    $location = $appointment->location;

                    // Use appointment_datetime (stored in UTC)
                    $utcDateTime = \Carbon\Carbon::parse($appointment->appointment_datetime);

                    // Convert UTC time to tenant timezone for display (same as practitioner calendar)
                    $tenantDateTime = \App\Services\TenantTimezoneService::convertToTenantTime($utcDateTime);

                    $durationMinutes = $service->default_duration_minutes ?? 60;

                    $appointments[] = [
                        'id' => $appointment->id,
                        'tenant_id' => tenant('id'),
                        'title' => ($service ? $service->name : 'Appointment').' with '.$practitionerName,
                        'date' => $tenantDateTime->format('Y-m-d'),
                        'time' => $tenantDateTime->format('H:i'),
                        'duration' => $durationMinutes,
                        'patient' => $patient->first_name.' '.$patient->last_name,
                        'practitioner' => $practitionerName,
                        'type' => $service ? $service->name : 'General Consultation',
                        'status' => $appointment->status,
                        'location' => $location ? $location->name : ($appointment->mode === 'virtual' ? 'Virtual' : 'Unknown Location'),
                        'clinic' => tenant('name') ?? 'Unknown Clinic',
                        'source' => 'clinic',
                        'clickable' => true,
                        'mode' => $appointment->mode,
                        'notes' => $appointment->notes,
                    ];
                }

                return Inertia::render('Calendar/Index', [
                    'appointments' => $appointments,
                    'currentDate' => now()->toDateString(),
                    'userRole' => 'patient',
                    'isCentral' => false,
                    'practitioners' => [], // Patients don't need practitioner filter
                ]);
            }

            // For practitioners, use the existing controller
            return app(CalendarController::class)->index();
        })
            ->name('calendar.index');

        // Role-based My Details - same URL, different functionality based on user role
        Route::get('/my-details', [PatientDashboardController::class, 'myDetails'])
            ->name('my-details.index');
        Route::put('/my-details', [PatientDashboardController::class, 'updateMyDetails'])
            ->name('my-details.update');

        // Patient Dashboard API endpoints
        Route::get('/api/patient-dashboard/data', [PatientDashboardController::class, 'getDashboardData'])
            ->name('api.patient-dashboard.data');

        // Tenant Dashboard API endpoints
        Route::get('/api/dashboard/data', [\App\Http\Controllers\Tenant\DashboardController::class, 'getDashboardData'])
            ->name('api.dashboard.data');

        // Patient Medical History Management Routes
        Route::prefix('my-details')->name('my-details.')->group(function () {
            // Family Medical History
            Route::put('/family-medical-histories', [PatientDashboardController::class, 'updateFamilyMedicalHistories'])
                ->name('family-medical-histories.update');
            Route::delete('/family-medical-histories/{historyId}', [PatientDashboardController::class, 'deleteFamilyMedicalHistory'])
                ->name('family-medical-histories.delete');

            // Patient Medical History
            Route::put('/patient-medical-histories', [PatientDashboardController::class, 'updatePatientMedicalHistories'])
                ->name('patient-medical-histories.update');
            Route::delete('/patient-medical-histories/{historyId}', [PatientDashboardController::class, 'deletePatientMedicalHistory'])
                ->name('patient-medical-histories.delete');

            // Known Allergies
            Route::put('/known-allergies', [PatientDashboardController::class, 'updateKnownAllergies'])
                ->name('known-allergies.update');
            Route::delete('/known-allergies/{allergyId}', [PatientDashboardController::class, 'deleteKnownAllergy'])
                ->name('known-allergies.delete');
        });
        // Route::post('/my-details/services', [MyDetailsController::class, 'addService'])
        //     ->name('my-details.add-service');

        // Calendar conflict checking - tenant-specific route (needs to be accessible from tenant domain)
        Route::post('/integrations/check-calendar-conflicts', [\App\Http\Controllers\UserIntegrationController::class, 'checkCalendarConflicts'])
            ->name('integrations.check-calendar-conflicts')
            ->middleware('auth'); // Ensure user is authenticated
        Route::post('/integrations/check-day-conflicts', [\App\Http\Controllers\UserIntegrationController::class, 'checkDayConflicts'])
            ->name('integrations.check-day-conflicts')
            ->middleware('auth'); // Ensure user is authenticated

        // Wallet routes
        Route::prefix('wallet')->name('wallet.')->group(function () {
            Route::get('/', [WalletController::class, 'index'])->name('index'); // Inertia page
            Route::get('/{wallet}', [TenantWalletApiController::class, 'show'])->name('show'); // API
            Route::get('/user/{user}', [TenantWalletApiController::class, 'showByUser'])->name('show-by-user'); // API
            Route::post('/{wallet}/recalculate', [TenantWalletApiController::class, 'recalculateBalance'])->name('recalculate'); // API
            Route::get('/practitioner/{practitionerId}/earnings', [TenantWalletApiController::class, 'practitionerEarnings'])->name('practitioner-earnings'); // API
            Route::post('/generate-invoice', [WalletController::class, 'generatePractitionerInvoice'])->name('generate-invoice'); // Invoice generation
        });

        // Current Session Route - Must be authenticated
        Route::get('/current-session/{appointment}', function ($appointmentId) {
            $user = Auth::user();

            // Get the appointment and verify security requirements
            $appointment = Appointment::with(['service', 'location'])
                ->where('id', $appointmentId)
                ->first();

            // Security check 1: Appointment must exist
            if (! $appointment) {
                abort(404, 'Appointment not found');
            }

            // Security check 2: Appointment must be today only
            // TODO: Re-enable date restriction later
            // $today = now()->toDateString();
            // $appointmentDate = $appointment->appointment_datetime->toDateString();
            // if ($appointmentDate !== $today) {
            //     abort(403, 'Access denied. This appointment is not scheduled for today.');
            // }

            // Security check 3: Appointment must belong to current practitioner
            $centralPractitioner = tenancy()->central(function () use ($user) {
                return Practitioner::where('user_id', $user->id)->first();
            });

            if (! $centralPractitioner) {
                abort(403, 'Access denied. You are not registered as a practitioner.');
            }

            // Get tenant practitioner using central_practitioner_id
            // After migration, appointment_practitioner.practitioner_id stores tenant practitioner IDs
            $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $centralPractitioner->id)->first();

            if (! $tenantPractitioner) {
                abort(403, 'Access denied. Practitioner not found in this organization.');
            }

            // Check if this practitioner is associated with this appointment through the pivot table
            // Use tenant practitioner ID (not central ID)
            $isAssignedPractitioner = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->where('practitioner_id', $tenantPractitioner->id)
                ->exists();

            if (! $isAssignedPractitioner) {
                abort(403, 'Access denied. This appointment is not assigned to you.');
            }

            // Get patient from central database
            $patient = null;
            if ($appointment->patient_id) {
                $patient = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });
            }

            // Get or create encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::with(['prescriptions', 'documentRequests'])
                ->where('appointment_id', $appointment->id)
                ->first();

            // Render intro page (lightweight) instead of full session page
            return Inertia::render('Session/Intro', [
                'appointment' => $appointment,
                'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
                'practitioner' => new PractitionerResource($centralPractitioner),
            ]);
        })->name('current-session');

        // Active Session Route - Shows the active session page with deferred loading support
        Route::get('/session/active/{appointment}', function ($appointmentId) {
            // Check if this is a partial reload request (deferred data loading)
            $isPartialReload = request()->header('X-Inertia-Partial-Data');

            // On initial load, return minimal data
            if (! $isPartialReload) {
                return Inertia::render('Session', [
                    'appointment' => ['id' => $appointmentId],
                    'patient' => null,
                    'practitioner' => null,
                    'encounter' => null,
                    'antMediaUrl' => null,
                ]);
            }

            // Return full data for partial reload (heavy data loading)
            $user = Auth::user();

            // Load appointment with relationships
            $appointment = Appointment::with(['service', 'location'])
                ->where('id', $appointmentId)
                ->first();

            if (! $appointment) {
                abort(404, 'Appointment not found');
            }

            $centralPractitioner = tenancy()->central(function () use ($user) {
                return Practitioner::where('user_id', $user->id)->first();
            });

            if (! $centralPractitioner) {
                abort(403, 'Access denied. You are not registered as a practitioner.');
            }

            // Get tenant practitioner using central_practitioner_id
            // After migration, appointment_practitioner.practitioner_id stores tenant practitioner IDs
            $tenantPractitioner = \App\Models\Practitioner::where('central_practitioner_id', $centralPractitioner->id)->first();

            if (! $tenantPractitioner) {
                abort(403, 'Access denied. Practitioner not found in this organization.');
            }

            // Use tenant practitioner ID (not central ID)
            $isAssignedPractitioner = DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->where('practitioner_id', $tenantPractitioner->id)
                ->exists();

            if (! $isAssignedPractitioner) {
                abort(403, 'Access denied. This appointment is not assigned to you.');
            }

            // Get patient from central database
            $patient = null;
            if ($appointment->patient_id) {
                $patient = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });
            }

            // Get or create encounter for this appointment
            $encounter = \App\Models\Tenant\Encounter::with(['prescriptions', 'documentRequests'])
                ->where('appointment_id', $appointment->id)
                ->first();

            // Get antmedia URL from tenant services config or fallback to environment
            $antMediaUrl = config('services.antmedia.url');

            // Render Session component with all required props
            return Inertia::render('Session', [
                'appointment' => $appointment,
                'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
                'practitioner' => new PractitionerResource($centralPractitioner),
                'encounter' => $encounter,
                'antMediaUrl' => $antMediaUrl,
            ]);
        })->name('session.active');

        // Session history detail route - separate page for viewing appointment history
        Route::get('/session/history/{appointmentHistoryId}', function ($appointmentHistoryId) {
            // This is a placeholder - you'll need to implement the actual logic
            // For now, we'll just return a simple view
            // The actual data will be passed from the Session.tsx component via navigation state

            return Inertia::render('Session/AppointmentHistoryDetail', [
                'appointment' => request()->get('appointment', []),
                'currentSessionId' => request()->get('currentSessionId', null),
            ]);
        })->name('session.history.detail');

        // Document management routes
        Route::prefix('encounters/{encounter}/documents')->name('encounters.documents.')->group(function () {
            Route::get('/', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'upload'])->name('index'); // Redirect index to upload
            Route::get('/create', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'create'])->name('create');
            Route::get('/upload', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'upload'])->name('upload');
            Route::post('/', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'store'])->name('store');
            Route::get('/{document}', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'show'])->name('show');
            Route::get('/{document}/download', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'download'])->name('download');
            Route::patch('/{document}', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'update'])->name('update');
            Route::delete('/{document}', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'destroy'])->name('destroy');
            Route::get('/count', [App\Http\Controllers\Tenant\EncounterDocumentController::class, 'count'])->name('count');
        });

        // Recording playback route (proxy to avoid CORS issues)
        Route::get('/encounters/{encounter}/recordings/{recording}/play', [App\Http\Controllers\Tenant\EncounterController::class, 'streamRecording'])
            ->name('encounters.recordings.play');
        Route::post('/encounters/{encounter}/recordings/{recording}/transcribe', [App\Http\Controllers\Tenant\EncounterController::class, 'transcribeRecording'])
            ->name('encounters.recordings.transcribe');
        Route::patch('/encounters/{encounter}/recordings/{recording}/speaker-names', [App\Http\Controllers\Tenant\EncounterController::class, 'updateSpeakerNames'])
            ->name('encounters.recordings.speaker-names');

        // Session management routes
        Route::post('/session/save', [App\Http\Controllers\Tenant\EncounterController::class, 'save'])->name('session.save');
        Route::post('/session/finish', [App\Http\Controllers\Tenant\EncounterController::class, 'finish'])->name('session.finish');

        // Session recording consent routes
        Route::post('/session/request-recording-consent', [App\Http\Controllers\Tenant\EncounterController::class, 'requestRecordingConsent'])
            ->name('session.request-recording-consent')
            ->withoutMiddleware(['auth', 'verified', 'can-access-tenant']);

        Route::get('/session/check-recording-consent/{appointmentId}', [App\Http\Controllers\Tenant\EncounterController::class, 'checkRecordingConsent'])
            ->name('session.check-recording-consent');

        Route::post('/session/save-recording', [App\Http\Controllers\Tenant\EncounterController::class, 'saveRecording'])
            ->name('session.save-recording');

        // Video session activity logging routes
        Route::post('/session/video/start', function (Request $request) {
            $request->validate([
                'appointment_id' => 'required|integer|exists:appointments,id',
            ]);

            $appointment = \App\Models\Tenant\Appointment::find($request->appointment_id);
            if (! $appointment) {
                return response()->json(['error' => 'Appointment not found'], 404);
            }

            \App\Services\VideoSessionActivityService::logVideoSessionStarted($appointment, $request);

            return redirect()->route('current-session', ['appointment' => $request->appointment_id])
                ->with('success', 'Video session started');
            // return response()->json(['success' => true]);
        })->name('session.video.start');

        Route::post('/session/video/stop', function (Request $request) {
            $request->validate([
                'appointment_id' => 'required|integer|exists:appointments,id',
            ]);

            $appointment = \App\Models\Tenant\Appointment::find($request->appointment_id);
            if (! $appointment) {
                return response()->json(['error' => 'Appointment not found'], 404);
            }

            \App\Services\VideoSessionActivityService::logVideoSessionStopped($appointment, $request);

            return redirect()->route('current-session', ['appointment' => $request->appointment_id])
                ->with('success', 'Video session ended');
            // return response()->json(['success' => true]);
        })->name('session.video.stop');

        // AI Summary route
        Route::post('/ai-summary/generate', [App\Http\Controllers\Tenant\AISummaryController::class, 'generateSummary'])->name('ai-summary.generate');

        // Test activity logging route (remove in production)
        Route::get('/test-activity-logging', [App\Http\Controllers\TestActivityController::class, 'testActivityLogging'])->name('test.activity-logging');

        // AI Chatbot routes
        Route::post('/ai-chat/stream', [App\Http\Controllers\Tenant\AIChatController::class, 'stream'])->name('ai-chat.stream');
        Route::post('/ai-chat/test-stream', [App\Http\Controllers\Tenant\AIChatController::class, 'testStream'])->name('ai-chat.test-stream');
        Route::post('/ai-chat/quick-help', [App\Http\Controllers\Tenant\AIChatController::class, 'quickHelp'])->name('ai-chat.quick-help');

        // Quick Create Routes (New menu)
        Route::get('/intake/create', [IntakeController::class, 'create'])->name('intake.create');
        Route::post('/intake/store', [IntakeController::class, 'store'])->name('intake.store');
        Route::post('/intake/search', [IntakeController::class, 'searchPatients'])->name('intake.search');
        Route::post('/intake/link', [IntakeController::class, 'linkPatient'])->name('intake.link');
        Route::post('/intake/fill-patient', [IntakeController::class, 'fillPatientData'])->name('intake.fillPatient');
        // Notes routes
        Route::resource('notes', NoteController::class);
        Route::post('/notes/reorder', [NoteController::class, 'reorder'])->name('notes.reorder');

        // Live Streaming Routes
        Route::get('/stream-creator', function () {
            $antMediaUrl = config('services.antmedia.url');

            return Inertia::render('LiveStreamingComponents/StreamCreator', [
                'antMediaUrl' => $antMediaUrl,
            ]);
        })->name('stream-creator');

        Route::get('/stream-joiner', function () {
            $antMediaUrl = config('services.antmedia.url');

            return Inertia::render('LiveStreamingComponents/StreamJoiner', [
                'antMediaUrl' => $antMediaUrl,
            ]);
        })->name('stream-joiner');
    });

    // Route::get('/register', fn () => abort(403));
    // Route::post('/register', fn () => abort(403));

    require __DIR__.'/settings.php';
    require __DIR__.'/auth.php';

    // Proxy route for S3 images to handle CORS
    Route::get('/logo-proxy/{tenant_id}', function ($tenantId) {
        try {
            // Initialize tenant context to access organization settings
            $tenant = \App\Models\Tenant::find($tenantId);
            if (! $tenant) {
                abort(404, 'Tenant not found');
            }

            tenancy()->initialize($tenant);

            // Get the actual S3 key from organization settings
            $logoSetting = \App\Models\OrganizationSetting::where('key', 'appearance_logo_s3_key')->first();
            if (! $logoSetting || ! $logoSetting->value) {
                \Log::info('Logo proxy: No logo setting found', ['tenant' => $tenantId]);
                abort(404, 'Logo not configured');
            }

            $s3Key = $logoSetting->value;
            $storage = Storage::disk('s3');

            if (! $storage->exists($s3Key)) {
                \Log::info('Logo proxy: S3 file not found', ['tenant' => $tenantId, 's3_key' => $s3Key]);
                abort(404, 'Logo file not found');
            }

            $content = $storage->get($s3Key);
            $mimeType = $logoSetting->mime_type ?: ($storage->mimeType($s3Key) ?: 'image/png');

            \Log::info('Logo proxy: Successfully served logo', [
                'tenant' => $tenantId,
                's3_key' => $s3Key,
                'mime_type' => $mimeType,
                'size' => strlen($content),
            ]);

            return response($content, 200, [
                'Content-Type' => $mimeType,
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET',
                'Access-Control-Allow-Headers' => 'Content-Type',
                'Cache-Control' => 'no-cache, no-store, must-revalidate', // Prevent caching for logo updates
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]);

        } catch (\Exception $e) {
            \Log::error('Logo proxy error', ['error' => $e->getMessage(), 'tenant' => $tenantId]);
            abort(500, 'Error loading logo');
        }
    })->name('logo.proxy');

    // Public Patient Appointment Iframe Route (tenant-branded)
    Route::get('/patient/appointment/{roomId}', function ($roomId) {
        // Get tenant information for branding
        $tenant = tenant();

        // Extract appointment ID from roomId (format: room_{appointment_id}_{timestamp})
        $appointmentId = null;
        $patient = null;

        if (preg_match('/^room_(\d+)/', $roomId, $matches)) {
            $appointmentId = $matches[1];

            try {
                // Get the appointment
                $appointment = \App\Models\Tenant\Appointment::find($appointmentId);

                if ($appointment && $appointment->patient_id) {
                    // Get patient details from central database
                    $patient = tenancy()->central(function () use ($appointment) {
                        return \App\Models\Patient::find($appointment->patient_id);
                    });
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load patient details for appointment', [
                    'tenant_id' => $tenant->id,
                    'room_id' => $roomId,
                    'appointment_id' => $appointmentId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Get appearance settings
        $appearanceSettings = [];
        try {
            $logoSetting = \App\Models\OrganizationSetting::where('key', 'appearance_logo_s3_key')->first();
            $colorSetting = \App\Models\OrganizationSetting::where('key', 'appearance_theme_color')->first();
            $fontSetting = \App\Models\OrganizationSetting::where('key', 'appearance_font_family')->first();

            if ($logoSetting && $logoSetting->value) {
                $appearanceSettings['appearance_logo_path'] = route('logo.proxy', ['tenant_id' => $tenant->id]);
            }
            if ($colorSetting && $colorSetting->value) {
                $appearanceSettings['appearance_theme_color'] = $colorSetting->value;
            }
            if ($fontSetting && $fontSetting->value) {
                $appearanceSettings['appearance_font_family'] = $fontSetting->value;
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to load appearance settings for patient appointment', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Get antmedia URL from tenant services config or fallback to environment
        $antMediaUrl = config('services.antmedia.url');

        return Inertia::render('PatientAppointment', [
            'roomId' => $roomId,
            'antMediaUrl' => $antMediaUrl,
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? 'Healthcare Practice',
            ],
            'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
            'appointmentId' => $appointmentId,
            'appearanceSettings' => $appearanceSettings,
        ]);
    })->name('patient.appointment');

    // Signed URL routes for secure access
    Route::get('/appointments/{appointment}/patient-view', function (Request $request, $appointment) {
        $token = $request->query('token');

        if (! $token) {
            abort(403, 'Invalid access token');
        }

        $signedUrlService = app(\App\Services\AppointmentSignedUrlService::class);
        $payload = $signedUrlService->verifyToken($token);

        if (! $payload || $payload['participant_type'] !== 'patient' || $payload['appointment_id'] != $appointment) {
            abort(403, 'Invalid or expired access token');
        }

        // Get tenant information for branding
        $tenant = tenant();
        $appointmentModel = \App\Models\Tenant\Appointment::find($appointment);

        if (! $appointmentModel) {
            abort(404, 'Appointment not found');
        }

        // Get patient details from central database
        $patient = tenancy()->central(function () use ($appointmentModel) {
            return \App\Models\Patient::find($appointmentModel->patient_id);
        });

        // Log patient video session access
        \App\Services\VideoSessionActivityService::logPatientSessionAccess($appointmentModel, $request);

        // Get appearance settings
        $appearanceSettings = [];
        try {
            $logoSetting = \App\Models\OrganizationSetting::where('key', 'appearance_logo_s3_key')->first();
            $colorSetting = \App\Models\OrganizationSetting::where('key', 'appearance_theme_color')->first();
            $fontSetting = \App\Models\OrganizationSetting::where('key', 'appearance_font_family')->first();

            if ($logoSetting && $logoSetting->value) {
                $appearanceSettings['appearance_logo_path'] = route('logo.proxy', ['tenant_id' => $tenant->id]);
            }
            if ($colorSetting && $colorSetting->value) {
                $appearanceSettings['appearance_theme_color'] = $colorSetting->value;
            }
            if ($fontSetting && $fontSetting->value) {
                $appearanceSettings['appearance_font_family'] = $fontSetting->value;
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to load appearance settings for patient appointment', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Get antmedia URL from tenant services config or fallback to environment
        $antMediaUrl = config('services.antmedia.url');
        $roomId = 'room_'.$appointment;

        return Inertia::render('PatientAppointment', [
            'roomId' => $roomId,
            'antMediaUrl' => $antMediaUrl,
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? 'Healthcare Practice',
            ],
            'patient' => $patient ? (new PatientMinimalResource($patient))->resolve() : null,
            'appointmentId' => $appointment,
            'appearanceSettings' => $appearanceSettings,
        ]);
    })->name('appointments.patient-view');

    Route::get('/appointments/{appointment}/invited-view', function (Request $request, $appointment) {
        $token = $request->query('token');

        if (! $token) {
            abort(403, 'Invalid access token');
        }

        $signedUrlService = app(\App\Services\AppointmentSignedUrlService::class);
        $payload = $signedUrlService->verifyToken($token);

        if (! $payload || $payload['participant_type'] !== 'invited' || $payload['appointment_id'] != $appointment) {
            abort(403, 'Invalid or expired access token');
        }

        // Get tenant information for branding
        $tenant = tenant();
        $appointmentModel = \App\Models\Tenant\Appointment::find($appointment);

        if (! $appointmentModel) {
            abort(404, 'Appointment not found');
        }

        // Log invited participant video session access
        \App\Services\VideoSessionActivityService::logInvitedParticipantSessionAccess(
            $appointmentModel,
            $payload['email'],
            $payload['email'], // Use email as name for invited participants
            $request
        );

        // Get appearance settings
        $appearanceSettings = [];
        try {
            $logoSetting = \App\Models\OrganizationSetting::where('key', 'appearance_logo_s3_key')->first();
            $colorSetting = \App\Models\OrganizationSetting::where('key', 'appearance_theme_color')->first();
            $fontSetting = \App\Models\OrganizationSetting::where('key', 'appearance_font_family')->first();

            if ($logoSetting && $logoSetting->value) {
                $appearanceSettings['appearance_logo_path'] = route('logo.proxy', ['tenant_id' => $tenant->id]);
            }
            if ($colorSetting && $colorSetting->value) {
                $appearanceSettings['appearance_theme_color'] = $colorSetting->value;
            }
            if ($fontSetting && $fontSetting->value) {
                $appearanceSettings['appearance_font_family'] = $fontSetting->value;
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to load appearance settings for invited participant', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Get antmedia URL from tenant services config or fallback to environment
        $antMediaUrl = config('services.antmedia.url');
        $roomId = 'room_'.$appointment;

        return Inertia::render('InvitedParticipantAppointment', [
            'roomId' => $roomId,
            'antMediaUrl' => $antMediaUrl,
            'tenant' => [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? 'Healthcare Practice',
            ],
            'participant' => [
                'email' => $payload['email'],
                'name' => $payload['email'], // Use email as name for invited participants
            ],
            'appointmentId' => $appointment,
            'appearanceSettings' => $appearanceSettings,
        ]);
    })->name('appointments.invited-view');

    // Proxy route for practitioner profile pictures to handle CORS
    Route::get('/profile-picture-proxy/{practitioner_id}', function ($practitionerId) {
        try {
            // Find the practitioner
            $practitioner = \App\Models\Practitioner::find($practitionerId);
            if (! $practitioner || ! $practitioner->profile_picture_s3_key) {
                \Log::info('Profile picture proxy: No profile picture found', [
                    'practitioner_id' => $practitionerId,
                    's3_key' => $practitioner?->profile_picture_s3_key,
                ]);
                abort(404, 'Profile picture not found');
            }

            $s3Key = $practitioner->profile_picture_s3_key;
            $storage = Storage::disk('s3');

            if (! $storage->exists($s3Key)) {
                \Log::info('Profile picture proxy: S3 file not found', [
                    'practitioner_id' => $practitionerId,
                    's3_key' => $s3Key,
                ]);
                abort(404, 'Profile picture file not found');
            }

            $content = $storage->get($s3Key);
            $mimeType = $storage->mimeType($s3Key) ?: 'image/jpeg';

            \Log::info('Profile picture proxy: Successfully served profile picture', [
                'practitioner_id' => $practitionerId,
                's3_key' => $s3Key,
                'mime_type' => $mimeType,
                'size' => strlen($content),
            ]);

            return response($content, 200, [
                'Content-Type' => $mimeType,
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET',
                'Access-Control-Allow-Headers' => 'Content-Type',
                'Cache-Control' => 'no-cache, no-store, must-revalidate', // Prevent caching for profile picture updates
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]);

        } catch (\Exception $e) {
            \Log::error('Profile picture proxy error', ['error' => $e->getMessage(), 'practitioner_id' => $practitionerId]);
            abort(500, 'Error loading profile picture');
        }
    })->name('profile-picture.proxy');

    Route::get('/login', function (Request $request) {
        $centralLoginUrl = centralUrl('/login');

        // Forward query parameters to central login (e.g., intended URL, document access token)
        if ($request->getQueryString()) {
            $centralLoginUrl .= '?'.$request->getQueryString();
        }

        return Inertia::location($centralLoginUrl);
    })->name('login');

});

// Session Detection Endpoint - accessible from public portal but can detect authenticated sessions
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
])->get('/session-check', [PublicPortalController::class, 'debugSession'])->name('session-check');

// Public Portal Routes (no authentication required)
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    'public-tenant-access',
])->prefix('explore')->name('public-portal.')->group(function () {
    Route::get('/', [PublicPortalController::class, 'index'])->name('index');
    Route::get('/services', [PublicPortalController::class, 'services'])->name('services');
    Route::get('/locations', [PublicPortalController::class, 'locations'])->name('locations');
    Route::get('/staff', [PublicPortalController::class, 'staff'])->name('staff');
    Route::get('/staff/{practitioner}', [PublicPortalController::class, 'practitionerDetail'])->name('staff.detail');
    Route::get('/assess-yourself', [PublicPortalController::class, 'assessYourself'])->name('assess-yourself');
    Route::get('/book-appointment', [PublicPortalController::class, 'bookAppointment'])->name('book-appointment');
    Route::get('/book-appointment/{practitioner}', [PublicPortalController::class, 'bookPractitionerAppointment'])->name('book-practitioner-appointment');

    // Public appointment booking endpoints
    Route::post('/practitioner-availability', [PublicPortalController::class, 'getPractitionerAvailability'])->name('practitioner-availability');
    Route::post('/book-appointment', [PublicPortalController::class, 'submitAppointment'])->name('submit-appointment');
    Route::post('/register-and-book', [PublicPortalController::class, 'registerAndBook'])->name('register-and-book');
    Route::post('/check-patient-exists', [PublicPortalController::class, 'checkPatientExists'])->name('check-patient-exists');
    Route::post('/login-and-book', [PublicPortalController::class, 'loginAndBook'])->name('login-and-book');
    Route::post('/validate-email', [PublicPortalController::class, 'validateEmail'])->name('validate-email');
    Route::get('/patient-consents', [PublicPortalController::class, 'getPatientConsents'])->name('patient-consents');
    Route::get('/register', [PublicPortalController::class, 'showRegister'])->name('register');
    Route::post('/register', [PublicPortalController::class, 'submitRegister'])->name('submit-register');
    Route::get('/consents', [PublicPortalController::class, 'showConsents'])->name('consents');
    Route::post('/consents/accept', [PublicPortalController::class, 'acceptConsents'])->name('consents-accept');
    Route::post('/request-join-tenant', [PublicPortalController::class, 'requestJoinTenant'])->name('request-join-tenant');
    Route::post('/request-to-join', [PublicPortalController::class, 'requestToJoin'])->name('request-to-join');
    Route::post('/join-waiting-list', [PublicPortalController::class, 'joinWaitingList'])->name('join-waiting-list');

    // Public, unauthenticated calendar conflict endpoints (return benign results)
    Route::post('/integrations/check-calendar-conflicts', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'is_connected' => false,
            'has_conflict' => false,
            'message' => '',
        ]);
    })->name('public.integrations.check-calendar-conflicts');

    Route::post('/integrations/check-day-conflicts', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'is_connected' => false,
            'has_conflicts' => false,
            'conflicts' => [],
            'conflict_count' => 0,
            'message' => '',
        ]);
    })->name('public.integrations.check-day-conflicts');
});

// Virtual Appointment Session Routes (public access for patients)
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
])->group(function () {
    Route::get('/virtual-session/{appointment}', [App\Http\Controllers\Tenant\VirtualSessionController::class, 'show'])
        ->name('virtual-session.show');
    Route::post('/virtual-session/{appointment}/login', [App\Http\Controllers\Tenant\VirtualSessionController::class, 'login'])
        ->name('virtual-session.login');

    // Waiting list routes at tenant level (public, no auth)
    Route::get('/waiting-list/accept/{token}', [PublicPortalController::class, 'acceptWaitingListSlot'])->name('waiting-list.accept');
    Route::post('/waiting-list/confirm/{token}', [PublicPortalController::class, 'confirmWaitingListSlot'])->name('waiting-list.confirm');

    // Patient invitation acceptance (no auth required)
    Route::get('/patient/invitation/{token}', [\App\Http\Controllers\PatientInvitationController::class, 'show'])
        ->name('patient.invitation.accept');
    Route::post('/patient/invitation/{token}', [\App\Http\Controllers\PatientInvitationController::class, 'accept'])
        ->name('patient.invitation.accept.submit');

    // Document Access Routes (public access for patients via email link)
    Route::get('/documents/access/{token}', [App\Http\Controllers\Tenant\DocumentAccessController::class, 'showAccessPage'])->name('documents.access');
    Route::post('/documents/verify-patient', [App\Http\Controllers\Tenant\DocumentAccessController::class, 'verifyPatient'])->name('documents.verify');
    Route::get('/documents/preview/{encounter}', [App\Http\Controllers\Tenant\DocumentAccessController::class, 'previewDocuments'])->name('documents.preview');

    // Public Consent Routes (for patient consent acceptance via email links)
    Route::get('/consents/show/{token}', [App\Http\Controllers\PublicConsentController::class, 'show'])->name('consents.show');
    Route::post('/consents/accept', [App\Http\Controllers\PublicConsentController::class, 'accept'])->name('consents.accept');

    // Policy & Consent Management Routes (admin only)
    // Existing Routes (policies-consents group)
    Route::middleware(['auth', 'permission:view-policies-consents'])->group(function () {
        Route::prefix('policies-consents')->name('policies-consents.')->group(function () {
            Route::get('/', [ConsentManagementController::class, 'index'])->name('index');
            Route::get('/create', [ConsentManagementController::class, 'create'])->name('create');
            Route::post('/', [ConsentManagementController::class, 'store'])->name('store');

            // Add Archive/Restore routes for Consent model
            Route::get('/archive', [ConsentManagementController::class, 'archive'])->name('archive');

            Route::post('/{consent}/restore', [ConsentManagementController::class, 'restore'])->name('restore')->withTrashed();

            Route::get('/{consent}', [ConsentManagementController::class, 'show'])->name('show');
            Route::post('/check-title', [ConsentManagementController::class, 'checkTitle'])->name('check-title');
            Route::post('/versions/{version}/toggle', [ConsentManagementController::class, 'toggleVersion'])->name('versions.toggle');
            Route::post('/versions/{version}/accept', [ConsentManagementController::class, 'acceptConsent'])->name('versions.accept');
            Route::post('/check-acceptance', [ConsentManagementController::class, 'checkConsentAcceptance'])->name('check-acceptance');
            Route::post('/document-upload/accept', [ConsentManagementController::class, 'acceptDocumentUploadConsent'])->name('document-upload.accept');

            // The original destroy route now soft deletes the Consent
            Route::delete('/{consent}', [ConsentManagementController::class, 'destroy'])->name('destroy');
        });
    });

    // Since EntityConsentController is focused on archival, and we moved archiving to Consent,
    // we should check the full EntityConsent routes and remove the unused ones if they exist.
    // Based on the provided code, EntityConsentController is a full resource, so update its usage.
    // Assuming the routes for 'consents.*' in the frontend map to EntityConsentController for *user-level* consents.
    // If the user consents are still managed by EntityConsentController, we must remove the archive logic from it.
    /* // Example of old EntityConsentController routes to be removed if they exist:
        Route::get('/consents', [EntityConsentController::class, 'index'])->name('consents.index');
        Route::get('/consents/archive', [EntityConsentController::class, 'archive'])->name('consents.archive');
        Route::delete('/consents/{entityConsent}', [EntityConsentController::class, 'destroy'])->name('consents.destroy');
        Route::post('/consents/{entityConsent}/restore', [EntityConsentController::class, 'restore'])->name('consents.restore');
    */

    // Entity Consent Routes (consent acceptances management)
    // Billing routes - resubscription (tenant level only)
    Route::middleware(['auth', 'verified'])->prefix('billing')->name('billing.')->group(function () {
        Route::get('/access-blocked', [\App\Http\Controllers\BillingController::class, 'accessBlocked'])->name('access-blocked');
        Route::post('/update-payment-method', [\App\Http\Controllers\BillingController::class, 'updatePaymentMethod'])->name('update-payment-method');
        Route::post('/checkout', [\App\Http\Controllers\BillingController::class, 'createCheckoutSession'])->name('checkout');
        Route::post('/resubscribe', [\App\Http\Controllers\BillingController::class, 'resubscribe'])->name('resubscribe');
        Route::get('/success', [\App\Http\Controllers\BillingController::class, 'success'])->name('success');
    });

    Route::middleware(['auth'])->prefix('consents')->name('consents.')->group(function () {
        Route::get('/', [App\Http\Controllers\Tenant\EntityConsentController::class, 'index'])->name('index');
        Route::get('/archive', [App\Http\Controllers\Tenant\EntityConsentController::class, 'archive'])->name('archive');
        Route::delete('/{entityConsent}', [App\Http\Controllers\Tenant\EntityConsentController::class, 'destroy'])->name('destroy');
        Route::post('/{id}/restore', [App\Http\Controllers\Tenant\EntityConsentController::class, 'restore'])->name('restore');
    });

// Website Settings API Routes (for admin) - DISABLED: patient-portal is central-only
/*
Route::middleware(['web', InitializeTenancyByDomain::class, 'auth'])
    ->prefix('api/website-settings')
    ->name('api.website-settings.')
    ->group(function () {
        Route::get('/navigation', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'getNavigationSettings'])->name('navigation.get');
        Route::post('/navigation', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'saveNavigationSettings'])->name('navigation.save');
        Route::get('/layout', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'getLayoutSettings'])->name('layout.get');
        Route::post('/layout', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'saveLayoutSettings'])->name('layout.save');
        Route::get('/appearance', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'getAppearanceSettings'])->name('appearance.get');
        Route::post('/appearance', [App\Http\Controllers\Settings\WebsiteSettingsController::class, 'saveAppearanceSettings'])->name('appearance.save');
    });

// Marketplace Payment Routes (Public - no auth required)
Route::middleware(['web', InitializeTenancyByDomain::class])
    ->prefix('pay')
    ->name('payment.')
    ->group(function () {
        Route::get('/{appointmentId?}', [App\Http\Controllers\Tenant\MarketplacePaymentController::class, 'show'])->name('show');
        Route::post('/create-intent', [App\Http\Controllers\Tenant\MarketplacePaymentController::class, 'createPaymentIntent'])->name('create-intent');
        Route::get('/success', [App\Http\Controllers\Tenant\MarketplacePaymentController::class, 'success'])->name('success');
        Route::get('/cancel', [App\Http\Controllers\Tenant\MarketplacePaymentController::class, 'cancel'])->name('cancel');
        Route::get('/status/{paymentIntentId}', [App\Http\Controllers\Tenant\MarketplacePaymentController::class, 'status'])->name('status');
    });
*/ // End of disabled tenant routes for patient-portal (central-only)
// __DIR__.'/diagnostic-routes.php';

Route::get('/diagnostic-error', function () {
    throw new Exception('This is a test exception to verify error reporting is visible.');
});

Route::get('/diagnostic-log', function () {
    \Log::info('Diagnostic log test');

    return 'Log entry created. Check your logs.';
});
