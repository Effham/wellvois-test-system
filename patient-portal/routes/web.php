<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Central\AppointmentController as CentralAppointmentController;
use App\Http\Controllers\Central\CalendarController as CentralCalendarController;
use App\Http\Controllers\Central\CentralDashboardController;
use App\Http\Controllers\Central\PatientCalendarController as CentralPatientCalendarController;
use App\Http\Controllers\Central\PractitionerDashboardController as CentralPractitionerDashboardController;
use App\Http\Controllers\DeveloperController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\PractitionerDetailsController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\UserController;
use App\Models\Patient;
use App\Models\Practitioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

foreach (config('tenancy.central_domains') as $domain) {
    Route::domain($domain)->group(function () {

        Route::get('/', function () {
            return redirect()->route('login.patient');
        })->name('home');

        // Health check routes - public access
        Route::prefix('health')->group(function () {
            Route::get('/', [HealthController::class, 'check'])->name('health.check');
            Route::get('/simple', [HealthController::class, 'simple'])->name('health.simple');
        });

        Route::get('/sso/user', function (Request $request) {
            $user = \App\Models\User::where('email', $request->email)->firstOrFail();

            return [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
            ];
        });

        // Lightweight endpoint for checking authentication status (used by bfcache detection)
        Route::get('/api/check-auth', function () {
            return response()->json([
                'authenticated' => Auth::check(),
            ]);
        })->name('api.check-auth');

        // Secure SSO: Generate one-time code and redirect to tenant
        Route::post('/sso/redirect', function (Request $request) {
            $user = Auth::user();
            $tenant = $user->tenants()->findOrFail($request->tenant_id);
            $redirectPath = $request->get('redirect', '/dashboard');

            // Note: Billing checks are handled in tenant context by RequireBillingSetup middleware
            // Let users access tenant normally - middleware will redirect if needed

            // Generate secure one-time code
            $ssoService = app(\App\Services\SecureSSOService::class);
            $code = $ssoService->generateSSOCode($user, $tenant, $redirectPath);

            // Generate tenant SSO URL with opaque code
            $ssoUrl = $ssoService->generateTenantSSOUrl($code, $tenant);

            // Use Inertia location for proper client-side handling
            return Inertia::location($ssoUrl);
        })->name('tenant.sso.redirect');

        // Route::get('/developer/check', [DeveloperController::class, 'check'])->name('developer.check');

        // Secure SSO: Exchange code endpoint (server-to-server)
        Route::post('/sso/exchange', function (Request $request) {
            $request->validate([
                'code' => 'required|string|min:32',
                'tenant_id' => 'required|string',
            ]);

            $ssoService = app(\App\Services\SecureSSOService::class);

            // Validate that the request is coming from a legitimate tenant
            if (! $ssoService->validateTenantRequest($request, $request->tenant_id)) {
                abort(403, 'Invalid tenant request');
            }

            // Exchange the code for user data
            $userData = $ssoService->exchangeSSOCode(
                $request->code,
                $request->header('X-Session-ID') // Optional session binding
            );

            if (! $userData) {
                abort(403, 'Invalid or expired SSO code');
            }

            // Verify the tenant ID matches what's in the code
            if ($userData['tenant_id'] !== $request->tenant_id) {
                abort(403, 'Tenant ID mismatch');
            }

            return response()->json([
                'success' => true,
                'user_id' => $userData['user_id'],
                'user_email' => $userData['user_email'],
                'tenant_id' => $userData['tenant_id'],
                'redirect_internal' => $userData['redirect_internal'],
            ]);
        })->name('sso.exchange');

        // Central authentication endpoint for public portal registrations
        Route::get('/auth/public-portal', function (Request $request) {
            $userId = $request->query('user_id');
            $hash = $request->query('hash');
            $expires = $request->query('expires');

            \Illuminate\Support\Facades\Log::info('Public portal auth attempt', [
                'user_id' => $userId,
                'hash' => $hash,
                'expires' => $expires,
                'current_time' => time(),
            ]);

            // Validate expiration
            if (! $expires || $expires < time()) {
                \Illuminate\Support\Facades\Log::warning('Public portal auth link expired', [
                    'user_id' => $userId,
                    'expires' => $expires,
                    'current_time' => time(),
                ]);

                return redirect()->route('login.patient')->with('error', 'Authentication link has expired. Please try again.');
            }

            // Get user and validate hash
            $user = \App\Models\User::find($userId);
            if (! $user) {
                \Illuminate\Support\Facades\Log::error('Public portal auth user not found', ['user_id' => $userId]);

                return redirect()->route('login.patient')->with('error', 'User not found. Please try again.');
            }

            // Create expected hash
            $expectedHash = hash('sha256', $user->email.$userId.$expires.config('app.key'));

            if (! hash_equals($expectedHash, $hash)) {
                \Illuminate\Support\Facades\Log::warning('Invalid public portal auth hash', [
                    'user_id' => $userId,
                    'expected' => $expectedHash,
                    'received' => $hash,
                ]);

                return redirect()->route('login.patient')->with('error', 'Invalid authentication link. Please try again.');
            }

            // Authenticate the user
            Auth::login($user);

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            \Illuminate\Support\Facades\Log::info('Public portal authentication successful', [
                'user_id' => $user->id,
                'email' => $user->email,
                'session_id' => session()->getId(),
            ]);

            // Check if user is a patient and needs to accept consents
            $patient = \App\Models\Patient::where('user_id', $user->id)->first();

            if ($patient) {
                // Get user's tenants
                $userTenants = userTenants($user);

                // Check consents if patient has tenants
                if (! empty($userTenants)) {
                    $pendingConsents = [];

                    try {
                        $firstTenant = \App\Models\Tenant::find($userTenants[0]['id']);

                        if ($firstTenant) {
                            // Initialize tenant to check consents
                            \Stancl\Tenancy\Facades\Tenancy::initialize($firstTenant);

                            // Get all patient consents
                            $allConsents = \App\Models\Tenant\Consent::where('entity_type', 'PATIENT')
                                ->with('activeVersion')
                                ->get()
                                ->filter(fn ($consent) => $consent->activeVersion !== null);

                            // Check which consents patient has accepted
                            foreach ($allConsents as $consent) {
                                if (! $consent->activeVersion) {
                                    continue;
                                }

                                $hasAccepted = \App\Models\Tenant\EntityConsent::where('consentable_type', 'App\Models\Patient')
                                    ->where('consentable_id', $patient->id)
                                    ->where('consent_version_id', $consent->activeVersion->id)
                                    ->exists();

                                if (! $hasAccepted) {
                                    $pendingConsents[] = [
                                        'id' => $consent->id,
                                        'key' => $consent->key,
                                        'title' => $consent->title,
                                        'entity_type' => $consent->entity_type,
                                        'activeVersion' => [
                                            'id' => $consent->activeVersion->id,
                                            'version' => $consent->activeVersion->version,
                                            'status' => $consent->activeVersion->status,
                                            'consent_body' => $consent->activeVersion->consent_body,
                                            'created_at' => $consent->activeVersion->created_at,
                                            'updated_at' => $consent->activeVersion->updated_at,
                                        ],
                                    ];
                                }
                            }

                            \Stancl\Tenancy\Facades\Tenancy::end();
                        }
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::error('Error checking patient consents in auth', [
                            'error' => $e->getMessage(),
                            'patient_id' => $patient->id,
                        ]);
                    }
                }
            }

            // Redirect to central patient dashboard
            return redirect()->route('central.patient-dashboard')->with('success', 'Welcome to your dashboard!');
        })->name('auth.public-portal');

        // Billing tenant creation route - accessible without auth for Stripe redirects
        Route::get('/billing/tenant-creation', [\App\Http\Controllers\BillingController::class, 'tenantCreation'])
            ->name('billing.tenant-creation');

        // Payment success route - accessible without auth for Stripe Payment Link redirects
        Route::get('/payment/success', [\App\Http\Controllers\PaymentController::class, 'success'])
            ->name('payment.success');

        // Tenant creation status routes
        Route::get('/tenant-creation/status', [\App\Http\Controllers\TenantCreationStatusController::class, 'show'])
            ->name('tenant-creation.status');
        Route::get('/api/tenant-creation-status', [\App\Http\Controllers\TenantCreationStatusController::class, 'checkStatus'])
            ->name('api.tenant-creation-status');
        Route::get('/tenant-creation/redirect', [\App\Http\Controllers\TenantCreationStatusController::class, 'redirect'])
            ->name('tenant-creation.redirect');

        Route::middleware(['auth', 'verified', 'can-access-tenant'])->group(function () {

            // Billing Routes (registration/setup on central, trial-expired/resubscription on tenant)
            Route::prefix('billing')->name('billing.')->group(function () {
                Route::get('/setup', [\App\Http\Controllers\BillingController::class, 'setup'])->name('setup');
                Route::post('/checkout-session', [\App\Http\Controllers\BillingController::class, 'createSetupCheckoutSession'])->name('checkout-session.create');
                Route::get('/checkout-success', [\App\Http\Controllers\BillingController::class, 'handleCheckoutSuccess'])->name('checkout-success');
                Route::post('/setup-intent', [\App\Http\Controllers\BillingController::class, 'createSetupIntent'])->name('setup-intent.create');
                Route::post('/setup-intent/success', [\App\Http\Controllers\BillingController::class, 'handleSetupIntentSuccess'])->name('setup-intent.success');
                Route::get('/{tenant}/portal', [\App\Http\Controllers\BillingController::class, 'portal'])->name('portal');
                Route::get('/{tenant}/subscription', [\App\Http\Controllers\BillingController::class, 'show'])->name('show');
            });

            Route::get('/sso/switch-tenant/{tenant}', function (Request $request, $tenant) {
                $user = Auth::user();
                $tenantModel = $user->tenants()->findOrFail($tenant);
                $redirectPath = $request->query('redirect', '/dashboard');

                // Generate secure one-time code for tenant switch
                $ssoService = app(\App\Services\SecureSSOService::class);
                $code = $ssoService->generateSSOCode($user, $tenantModel, $redirectPath);
                $ssoUrl = $ssoService->generateTenantSSOUrl($code, $tenantModel);

                return redirect()->away($ssoUrl);
            })->name('tenant.sso.switch');

            Route::get('dashboard', function () {
                $user = Auth::user();

                // Check practitioner/patient records (central + tenant-level)
                $hasPractitionerRecord = userHasPractitionerRecord($user);
                $hasPatientRecord = userHasPatientRecord($user);

                // Redirect based on table records (not roles)
                if ($hasPractitionerRecord && $hasPatientRecord) {
                    // Both records → Default to practitioner dashboard
                    return redirect()->route('central.practitioner-dashboard');
                } elseif ($hasPractitionerRecord) {
                    return redirect()->route('central.practitioner-dashboard');
                } elseif ($hasPatientRecord) {
                    return redirect()->route('central.patient-dashboard');
                }

                // No practitioner/patient records → Continue to admin/tenant logic
                // Admin/Staff users: Check tenant relationships
                // - Multiple tenants: show tenant selection (they can switch between clinics)
                // - One tenant: redirect to that tenant
                // - No tenants: central-only admin, show central dashboard
                $tenants = $user->tenants()->with('domains')->get();

                if ($tenants->count() > 1) {
                    // Multiple tenants - show tenant selection
                    return redirect()->route('tenant.selection');
                }

                if ($tenants->count() === 1) {
                    // Single tenant - redirect to that tenant
                    $tenant = $tenants->first();
                    $tenantSessionService = app(\App\Services\TenantSessionService::class);
                    $url = $tenantSessionService->switchToTenant($user, $tenant);

                    return Inertia::location($url);
                }

                // No tenants - central-only admin
                return redirect()->route('central.dashboard');
            })->name('dashboard');

            Route::get('/central/dashboard', [CentralDashboardController::class, 'index'])
                ->name('central.dashboard');

            Route::get('/central/practitioner-dashboard', function (Request $request) {
                $user = Auth::user();

                // Check if user has practitioner record (central OR any tenant)
                $hasPractitionerRecord = userHasPractitionerRecord($user);

                if (! $hasPractitionerRecord) {
                    abort(403, 'Access denied. You are not registered as a practitioner.');
                }

                return app(CentralPractitionerDashboardController::class)->index($request);
            })->name('central.practitioner-dashboard');

            Route::get('/central/patient-dashboard', function (Request $request) {
                $user = Auth::user();

                // Check if user has patient record (central OR any tenant)
                $hasPatientRecord = userHasPatientRecord($user);

                if (! $hasPatientRecord) {
                    abort(403, 'Access denied. You are not registered as a patient.');
                }

                // Get patient record for rendering (prefer central, fallback to any)
                $patient = \App\Models\Patient::where('user_id', $user->id)->first();

                // Get user's tenants for the dropdown
                $userTenants = userTenants($user);

                // Check if user came from public portal with waiting list signup
                $waitingListSuccess = false;
                $appointmentSuccess = false;

                \Illuminate\Support\Facades\Log::info('CENTRAL_DASHBOARD: Checking cookies', [
                    'from_public_portal' => $request->cookie('from_public_portal'),
                    'is_waiting_list' => $request->cookie('is_waiting_list'),
                    'appointment_booked' => $request->cookie('appointment_booked'),
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                ]);

                if ($request->cookie('from_public_portal')) {
                    if ($request->cookie('is_waiting_list')) {
                        $waitingListSuccess = true;
                        \Illuminate\Support\Facades\Log::info('CENTRAL_DASHBOARD: Setting waitingListSuccess = true');
                        // Clear the cookies after use
                        cookie()->queue(cookie()->forget('is_waiting_list'));
                    } elseif ($request->cookie('appointment_booked')) {
                        $appointmentSuccess = true;
                        \Illuminate\Support\Facades\Log::info('CENTRAL_DASHBOARD: Setting appointmentSuccess = true');
                        // Clear the cookies after use
                        cookie()->queue(cookie()->forget('appointment_booked'));
                    }
                    // Clear the from_public_portal cookie after use
                    cookie()->queue(cookie()->forget('from_public_portal'));
                } else {
                    \Illuminate\Support\Facades\Log::info('CENTRAL_DASHBOARD: No from_public_portal cookie found');
                }

                \Illuminate\Support\Facades\Log::info('CENTRAL_DASHBOARD: Rendering dashboard with props', [
                    'waitingListSuccess' => $waitingListSuccess,
                    'appointmentSuccess' => $appointmentSuccess,
                    'user_id' => $user->id,
                ]);

                // Get timezone information for central context
                $tenantTimezone = config('app.timezone', 'UTC');
                $tenantTimezoneDisplay = 'Local Time';

                return Inertia::render('PatientDashboard/Index', [
                    'patient' => $patient,
                    'isCentral' => true,
                    'waitingListSuccess' => $waitingListSuccess,
                    'appointmentSuccess' => $appointmentSuccess,
                    'tenantTimezone' => $tenantTimezone,
                    'tenantTimezoneDisplay' => $tenantTimezoneDisplay,
                    'tenancy' => [
                        'is_central' => true,
                        'current' => null, // No current tenant in central context
                        'logo' => null,
                    ],
                    'auth' => [
                        'user' => array_merge($user->load('roles')->toArray(), [
                            'tenants' => $userTenants,
                            'is_patient' => true,
                            'is_practitioner' => false,
                            'is_onboarding' => ((int) (
                                data_get(\App\Models\Patient::where('user_id', $request->user()->id)->first(), 'meta_data.is_onboarding')
                                ?? 0
                            ) === 1),
                        ]),

                    ],
                ]);
            })->name('central.patient-dashboard');

            Route::get('/central/calendar', function (Request $request) {
                $user = Auth::user();

                // Check if user is a patient
                $patient = \App\Models\Patient::where('user_id', $user->id)->first();
                if ($patient) {
                    // Use patient calendar controller
                    return app(CentralPatientCalendarController::class)->index();
                }

                // For practitioners, use the existing calendar controller
                return app(CentralCalendarController::class)->index();
            })
                ->name('central.calendar');

            Route::get('/central/appointments', [CentralAppointmentController::class, 'index'])
                ->name('central.appointments');

            Route::get('/central/practitioner-details', [PractitionerDetailsController::class, 'index'])
                ->name('central.practitioner-details');

            // Central my-details route - handles both patients and practitioners
            Route::get('/central/my-details', function (Request $request) {
                $user = Auth::user();

                // Check if user is a practitioner
                $practitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
                if ($practitioner) {
                    // Redirect to practitioner dashboard myDetails
                    return app(\App\Http\Controllers\Central\PractitionerDashboardController::class)->myDetails($request);
                }

                // Check if user is a patient
                $patient = \App\Models\Patient::where('user_id', $user->id)->first();
                if ($patient) {
                    // Redirect patients to health history page
                    return redirect()->route('central.my-details.health-history');
                }

                // Neither patient nor practitioner - redirect to dashboard
                return redirect()->route('dashboard')->with('error', 'Profile not found. Please contact your administrator.');
            })->name('central.my-details');

            Route::get('/central/personal-information', [PractitionerDetailsController::class, 'personalInformation'])
                ->name('central.personal-information');

            // These are the routes for the central practitioner details form submissions.
            // They must be inside this middleware group to be accessible.
            Route::post('/practitioners/store-basic-info', [PractitionerDetailsController::class, 'storeBasicInfo'])
                ->name('central.practitioners.store-basic-info');

            Route::post('/practitioners/store-professional-details', [PractitionerDetailsController::class, 'storeProfessionalDetails'])
                ->name('central.practitioners.store-professional-details');

            Route::post('/practitioners/store-availability', [PractitionerDetailsController::class, 'storeAvailability'])
                ->name('central.practitioners.store-availability');

            Route::get('/sso/central-redirect', function (Request $request) {
                $redirectPath = $request->query('redirect', '/');

                return Inertia::location($redirectPath);
            })->name('sso.central-redirect');

            Route::post('/practitioners/validate-email', [PractitionerDetailsController::class, 'validateEmail'])
                ->name('central.practitioners.validate-email');

            Route::post('/practitioner-details', [PractitionerDetailsController::class, 'update'])
                ->name('practitioner-details.update');

            // Central My Details routes for availability management
            Route::post('/central/my-details/locations/{locationId}/availability', [CentralPractitionerDashboardController::class, 'updateAvailability'])
                ->name('central.my-details.update-availability');

            Route::get('/central/my-details/available-days', [CentralPractitionerDashboardController::class, 'getAvailableDays'])
                ->name('central.my-details.available-days.get');

            Route::post('/central/my-details/available-days', [CentralPractitionerDashboardController::class, 'updateAvailableDays'])
                ->name('central.my-details.available-days.update');

            // Central Patient Health History Routes
            Route::prefix('/central/my-details')->name('central.my-details.')->group(function () {
                // Health History page (replaces old my-details for patients)
                Route::get('/health-history', [\App\Http\Controllers\Central\PatientDashboardController::class, 'healthHistory'])
                    ->name('health-history');
                Route::put('/health-history', [\App\Http\Controllers\Central\PatientDashboardController::class, 'updateHealthHistory'])
                    ->name('health-history.update');

                // Legacy medical history routes (kept for backward compatibility if needed)
                // Family Medical History
                Route::put('/family-medical-histories', [\App\Http\Controllers\Central\PatientDashboardController::class, 'updateFamilyMedicalHistories'])
                    ->name('family-medical-histories.update');
                Route::delete('/family-medical-histories/{historyId}', [\App\Http\Controllers\Central\PatientDashboardController::class, 'deleteFamilyMedicalHistory'])
                    ->name('family-medical-histories.delete');

                // Patient Medical History
                Route::put('/patient-medical-histories', [\App\Http\Controllers\Central\PatientDashboardController::class, 'updatePatientMedicalHistories'])
                    ->name('patient-medical-histories.update');
                Route::delete('/patient-medical-histories/{historyId}', [\App\Http\Controllers\Central\PatientDashboardController::class, 'deletePatientMedicalHistory'])
                    ->name('patient-medical-histories.delete');

                // Known Allergies
                Route::put('/known-allergies', [\App\Http\Controllers\Central\PatientDashboardController::class, 'updateKnownAllergies'])
                    ->name('known-allergies.update');
                Route::delete('/known-allergies/{allergyId}', [\App\Http\Controllers\Central\PatientDashboardController::class, 'deleteKnownAllergy'])
                    ->name('known-allergies.delete');
            });

            Route::get('/tenant-selection', function () {

                $user = Auth::user();

                $logoutKey = 'logout_user';
                $logout = tenancy()->central(function () use ($logoutKey) {
                    $value = Cache::store('database')->get($logoutKey, false);
                    Cache::store('database')->forget($logoutKey);

                    return $value;
                });

                if ($user && method_exists($user, 'tenants') && $user->tenants()->exists()) {
                    return Inertia::render('TenantSelection', [
                        'tenants' => userTenants($user),
                        'logout' => $logout,
                        'auth' => [
                            'user' => $user,
                        ],
                    ]);
                }
                abort(403, 'Unauthorized');
            })->name('tenant.selection');

            Route::get('/tenants/v2', [TenantController::class, 'index'])->name('tenants.index');

            Route::resource('tenants', TenantController::class);
            Route::post('/tenants/{tenant}/extend-trial', [TenantController::class, 'extendTrial'])->name('tenants.extend-trial');
            Route::resource('roles', RoleController::class);
            // Billing Settings (replaces plans routes)
            Route::prefix('billing')->name('billing.settings.')->group(function () {
                Route::get('/settings', [\App\Http\Controllers\BillingSettingsController::class, 'index'])->name('index');
                Route::get('/settings/plans', [\App\Http\Controllers\BillingSettingsController::class, 'plans'])->name('plans');
                Route::get('/settings/payment', [\App\Http\Controllers\BillingSettingsController::class, 'payment'])->name('payment');
                Route::put('/settings/payment', [\App\Http\Controllers\BillingSettingsController::class, 'update'])->name('payment.update');
            });

            // Plans resource routes removed - plans now managed via ENV and sync command
            // View-only route still available at /settings/billing/plans

            // Lightweight loading page for users index
            Route::get('users', function () {
                return Inertia::render('Users/Loading');
            })->name('users.index');

            // Heavy data page - Inertia only
            Route::get('users/loaded', [UserController::class, 'indexLoaded'])->name('users.index.loaded');

            Route::resource('users', UserController::class)->except(['index']);
            Route::get('users', [UserController::class, 'index'])->name('users.index');
            Route::resource('users', UserController::class)->except(['index', 'show']);
            Route::get('users-archived', [UserController::class, 'archived'])->name('users.archived');
            Route::post('users/{id}/restore', [UserController::class, 'restore'])->name('users.restore');
            Route::delete('users/{id}/force-delete', [UserController::class, 'forceDelete'])->name('users.force-delete');
            Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.updateRole');
            Route::post('users/timezone', [UserController::class, 'setTimezone'])->name('users.setTimezone');

            Route::get('/activity-logs', [ActivityLogController::class, 'index'])
                ->name('activity-logs.index');

            // Central Admin Dashboard API endpoint
            Route::get('/api/central/dashboard/data', [CentralDashboardController::class, 'getDashboardData'])
                ->name('api.central.dashboard.data');

            // Two-Factor Authentication Routes
            Route::prefix('two-factor-authentication')->name('two-factor-authentication.')->group(function () {
                Route::get('/setup', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'showSetupForm'])->name('setup');
                Route::post('/enable', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'enable'])->name('enable');
                Route::post('/disable', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'disable'])->name('disable');
                Route::get('/challenge', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'showChallengeForm'])->name('challenge');
                Route::post('/verify', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'verifyChallenge'])->name('verify');
            });

            // Central Patient Dashboard API endpoints
            Route::get('/api/patient-dashboard/data', [\App\Http\Controllers\Central\PatientDashboardController::class, 'getDashboardData'])
                ->name('api.central.patient-dashboard.data');

            // API endpoint for real-time patient invitation statuses
            Route::get('/api/patient/invitation-statuses', function (Request $request) {
                $user = Auth::user();

                // Only for patients
                $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();
                $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();

                if (! $isPatient || $isPractitioner) {
                    return response()->json(['statuses' => []]);
                }

                // Get patient ID and current invitation statuses
                $patientId = \App\Models\Patient::where('user_id', $user->id)->first()?->id;
                if (! $patientId) {
                    return response()->json(['statuses' => []]);
                }

                $statuses = \Illuminate\Support\Facades\DB::table('tenant_patients')
                    ->where('patient_id', $patientId)
                    ->pluck('invitation_status', 'tenant_id')
                    ->toArray();

                return response()->json(['statuses' => $statuses]);
            })->name('patient.invitation-statuses');

        }); // END of the middleware group

        Route::get('/register/invite/{token}', [AuthenticatedSessionController::class, 'showPatientRegistration'])
            ->name('patient.register.invite');

        Route::post('/register/invite/{token}', [AuthenticatedSessionController::class, 'registerPatient'])
            ->name('patient.register.invite.submit');

        // Practitioner invitation acceptance (no auth required)
        Route::get('/practitioner/invitation/{token}', [\App\Http\Controllers\PractitionerInvitationController::class, 'show'])
            ->name('practitioner.invitation.accept');
        Route::post('/practitioner/invitation/{token}', [\App\Http\Controllers\PractitionerInvitationController::class, 'accept'])
            ->name('practitioner.invitation.accept.submit');

        // Practitioner self-registration (new flow - no auth required)
        Route::post('/practitioner/self-registration/{token}', [\App\Http\Controllers\PractitionerInvitationController::class, 'handleSelfRegistration'])
            ->name('practitioner.self-registration.submit');

        // Patient invitation acceptance (no auth required)
        Route::get('/patient/invitation/{token}', [\App\Http\Controllers\PatientInvitationController::class, 'show'])
            ->name('patient.invitation.accept');
        Route::post('/patient/invitation/{token}', [\App\Http\Controllers\PatientInvitationController::class, 'accept'])
            ->name('patient.invitation.accept.submit');

        require __DIR__.'/settings.php';
        require __DIR__.'/auth.php';
        require __DIR__.'/diagnostic-routes.php';

        // Guest-only routes (register, login, etc.) - protected by central-guest middleware
        Route::middleware('central-guest')->group(function () {
            Route::get('/register', function (\Illuminate\Http\Request $request) {
                $plans = \App\Models\SubscriptionPlan::active()->get()->map(function ($plan) {
                    return [
                        'id' => $plan->id,
                        'name' => $plan->name,
                        'slug' => $plan->slug,
                        'price' => $plan->price,
                        'formatted_price' => $plan->formatted_price,
                        'billing_cycle' => $plan->billing_cycle,
                        'billing_interval' => $plan->billing_interval,
                        'billing_interval_count' => $plan->billing_interval_count,
                        'description' => $plan->description,
                        'features' => $plan->features,
                    ];
                });

                // Check if a plan is pre-selected via query parameter (using slug)
                $planSlug = $request->query('plan');
                $selectedPlan = null;
                $invalidPlan = false;

                if ($planSlug) {
                    $selectedPlan = \App\Models\SubscriptionPlan::active()
                        ->where('slug', $planSlug)
                        ->first();

                    if (! $selectedPlan) {
                        // Plan slug provided but not found - show error
                        $invalidPlan = true;
                    } else {
                        $selectedPlan = [
                            'id' => $selectedPlan->id,
                            'name' => $selectedPlan->name,
                            'slug' => $selectedPlan->slug,
                            'price' => $selectedPlan->price,
                            'formatted_price' => $selectedPlan->formatted_price,
                            'billing_cycle' => $selectedPlan->billing_cycle,
                            'billing_interval' => $selectedPlan->billing_interval,
                            'billing_interval_count' => $selectedPlan->billing_interval_count,
                            'description' => $selectedPlan->description,
                            'features' => $selectedPlan->features,
                        ];
                    }
                }

                return Inertia::render('RegisterPublic', [
                    'baseDomain' => env('BASE_TENANT_DOMAIN'),
                    'plans' => $plans,
                    'preSelectedPlan' => $selectedPlan,
                    'invalidPlan' => $invalidPlan,
                ]);
            })->name('register');

            Route::post('/register/prepare', [TenantController::class, 'prepare'])
                ->name('register.prepare');

            // Email verification routes for registration
            Route::post('/register/send-otp', [\App\Http\Controllers\EmailVerificationController::class, 'sendOTP'])
                ->name('register.send-otp');
            Route::post('/register/verify-otp', [\App\Http\Controllers\EmailVerificationController::class, 'verifyOTP'])
                ->name('register.verify-otp');

            // Change Plan route (guest accessible for registration flow)
            Route::get('/change-plan', [\App\Http\Controllers\ChangePlanController::class, 'show'])->name('change-plan.show');
            Route::post('/change-plan', [\App\Http\Controllers\ChangePlanController::class, 'update'])->name('change-plan.update');
        });

        // Google Calendar OAuth callback route to match environment redirect URI
        Route::get('/oauth/google/callback', [\App\Http\Controllers\UserIntegrationController::class, 'googleCalendarCallback'])
            ->name('oauth.google.callback');

        // User Integrations Routes on main domain
        Route::prefix('integrations')->name('integrations.')->middleware('auth')->group(function () {
            Route::get('/', [\App\Http\Controllers\UserIntegrationController::class, 'index'])->name('index');
            Route::get('/connect/{provider}', [\App\Http\Controllers\UserIntegrationController::class, 'connect'])->name('connect');
            Route::post('/connect/{provider}', [\App\Http\Controllers\UserIntegrationController::class, 'connect'])->name('connect.post');
            Route::post('/{userIntegration}/disconnect', [\App\Http\Controllers\UserIntegrationController::class, 'disconnect'])->name('disconnect');
            Route::post('/{userIntegration}/test', [\App\Http\Controllers\UserIntegrationController::class, 'test'])->name('test');
            Route::post('/{userIntegration}/sync', [\App\Http\Controllers\UserIntegrationController::class, 'sync'])->name('sync');
            Route::post('/{userIntegration}/resync', [\App\Http\Controllers\UserIntegrationController::class, 'resync'])->name('resync');
            Route::post('/{userIntegration}/toggle-calendar-conflicts', [\App\Http\Controllers\UserIntegrationController::class, 'toggleCalendarConflicts'])->name('toggle-calendar-conflicts');
            Route::post('/{userIntegration}/toggle-save-appointments', [\App\Http\Controllers\UserIntegrationController::class, 'toggleSaveAppointments'])->name('toggle-save-appointments');
            Route::put('/{userIntegration}/configuration', [\App\Http\Controllers\UserIntegrationController::class, 'updateConfiguration'])->name('configuration.update');
        });

        Route::post('/api/update-onboarding', function (Request $request) {
            $userId = $request->input('user_id');
            $isOnboarding = (int) $request->input('is_onboarding', 0); // 1 or 0

            if (! $userId) {
                return response()->json(['success' => false, 'message' => 'Missing user_id'], 400);
            }

            // Run updates in both central and tenant context safely
            $updateFn = function () use ($userId, $isOnboarding) {
                // Practitioner
                if ($practitioner = Practitioner::where('user_id', $userId)->first()) {
                    $meta = is_array($practitioner->meta_data)
                        ? $practitioner->meta_data
                        : (is_string($practitioner->meta_data)
                            ? json_decode($practitioner->meta_data, true)
                            : (array) $practitioner->meta_data);

                    $meta['is_onboarding'] = $isOnboarding;
                    $practitioner->meta_data = $meta;
                    $practitioner->save();
                }

                // Patient
                if ($patient = Patient::where('user_id', $userId)->first()) {
                    $meta = is_array($patient->meta_data)
                        ? $patient->meta_data
                        : (is_string($patient->meta_data)
                            ? json_decode($patient->meta_data, true)
                            : (array) $patient->meta_data);

                    $meta['is_onboarding'] = $isOnboarding;
                    $patient->meta_data = $meta;
                    $patient->save();
                }
            };

            // If tenant, perform update on central connection too
            $updateFn();

            // if (tenant('id')) {
            //     tenancy()->central($updateFn);
            // } else {
            // }

            return response()->json(['success' => true]);

        })->name('api.update-onboarding');
    });
}

// 2FA routes - NOT in guest middleware because user is authenticated during 2FA challenge
Route::get('two-factor-authentication/challenge', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'showChallengeForm'])
    ->name('two-factor-authentication.challenge')
    ->middleware('web');

Route::post('two-factor-authentication/verify', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'verifyChallenge'])
    ->name('two-factor-authentication.verify')
    ->middleware('web');

Route::post('two-factor-authentication/cancel', [\App\Http\Controllers\TwoFactorAuthenticationController::class, 'cancelChallenge'])
    ->name('two-factor-authentication.cancel')
    ->middleware('web');

// Legal pages routes - public access
Route::get('/terms-of-service', [\App\Http\Controllers\LegalController::class, 'termsOfService'])
    ->name('terms.show');

Route::get('/privacy-policy', [\App\Http\Controllers\LegalController::class, 'privacyPolicy'])
    ->name('privacy.show');

// Consent routes - public access
Route::prefix('consent')->group(function () {
    Route::get('administrative-access/{token}', [\App\Http\Controllers\ConsentController::class, 'showAdministrativeAccess'])
        ->name('consent.administrative-access.show');
    Route::post('administrative-access/{token}', [\App\Http\Controllers\ConsentController::class, 'acceptAdministrativeAccess'])
        ->name('consent.administrative-access.accept');

    Route::get('staff-permissions/{token}', [\App\Http\Controllers\ConsentController::class, 'showStaffPermissions'])
        ->name('consent.staff-permissions.show');
    Route::post('staff-permissions/{token}', [\App\Http\Controllers\ConsentController::class, 'acceptStaffPermissions'])
        ->name('consent.staff-permissions.accept');
});

Route::get('/diagnostic-stripe', function () {
    $diagnostics = [
        'timestamp' => now()->toIso8601String(),
        'environment' => [
            'app_env' => config('app.env'),
            'app_debug' => config('app.debug'),
        ],
        'configuration' => [],
        'connectivity' => [],
        'errors' => [],
    ];

    // Check environment variables
    $diagnostics['configuration']['env_variables'] = [
        'STRIPE_KEY' => [
            'set' => ! empty(env('STRIPE_KEY')),
            'value' => env('STRIPE_KEY') ? substr(env('STRIPE_KEY'), 0, 12).'...' : null,
            'prefix' => env('STRIPE_KEY') ? substr(env('STRIPE_KEY'), 0, 7) : null,
        ],
        'STRIPE_SECRET' => [
            'set' => ! empty(env('STRIPE_SECRET')),
            'value' => env('STRIPE_SECRET') ? substr(env('STRIPE_SECRET'), 0, 12).'...' : null,
            'prefix' => env('STRIPE_SECRET') ? substr(env('STRIPE_SECRET'), 0, 7) : null,
        ],
        'STRIPE_WEBHOOK_SECRET' => [
            'set' => ! empty(env('STRIPE_WEBHOOK_SECRET')),
            'value' => env('STRIPE_WEBHOOK_SECRET') ? substr(env('STRIPE_WEBHOOK_SECRET'), 0, 12).'...' : null,
            'prefix' => env('STRIPE_WEBHOOK_SECRET') ? substr(env('STRIPE_WEBHOOK_SECRET'), 0, 7) : null,
        ],
    ];

    // Check Cashier config
    $diagnostics['configuration']['cashier'] = [
        'key' => [
            'set' => ! empty(config('cashier.key')),
            'value' => config('cashier.key') ? substr(config('cashier.key'), 0, 12).'...' : null,
        ],
        'secret' => [
            'set' => ! empty(config('cashier.secret')),
            'value' => config('cashier.secret') ? substr(config('cashier.secret'), 0, 12).'...' : null,
        ],
        'webhook_secret' => [
            'set' => ! empty(config('cashier.webhook.secret')),
            'value' => config('cashier.webhook.secret') ? substr(config('cashier.webhook.secret'), 0, 12).'...' : null,
        ],
        'webhook_tolerance' => config('cashier.webhook.tolerance'),
        'currency' => config('cashier.currency'),
        'path' => config('cashier.path'),
    ];

    // Test Stripe API connectivity
    try {
        if (! empty(config('cashier.secret'))) {
            \Stripe\Stripe::setApiKey(config('cashier.secret'));

            // Test API call - retrieve account balance (read-only, safe)
            $balance = \Stripe\Balance::retrieve();
            $diagnostics['connectivity']['api_test'] = [
                'status' => 'success',
                'message' => 'Stripe API connection successful',
                'available_balance' => [
                    'amount' => $balance->available[0]->amount ?? null,
                    'currency' => $balance->available[0]->currency ?? null,
                ],
            ];
        } else {
            $diagnostics['connectivity']['api_test'] = [
                'status' => 'skipped',
                'message' => 'Stripe secret key not configured',
            ];
        }
    } catch (\Stripe\Exception\AuthenticationException $e) {
        $diagnostics['connectivity']['api_test'] = [
            'status' => 'failed',
            'message' => 'Authentication failed',
            'error' => $e->getMessage(),
        ];
        $diagnostics['errors'][] = 'Stripe authentication error: '.$e->getMessage();
    } catch (\Stripe\Exception\ApiErrorException $e) {
        $diagnostics['connectivity']['api_test'] = [
            'status' => 'failed',
            'message' => 'API error',
            'error' => $e->getMessage(),
            'type' => get_class($e),
        ];
        $diagnostics['errors'][] = 'Stripe API error: '.$e->getMessage();
    } catch (\Exception $e) {
        $diagnostics['connectivity']['api_test'] = [
            'status' => 'failed',
            'message' => 'Unexpected error',
            'error' => $e->getMessage(),
            'type' => get_class($e),
        ];
        $diagnostics['errors'][] = 'Unexpected error: '.$e->getMessage();
    }

    // Check Cashier service availability
    try {
        if (class_exists(\Laravel\Cashier\Cashier::class)) {
            $cashier = \Laravel\Cashier\Cashier::stripe();
            $diagnostics['connectivity']['cashier'] = [
                'status' => 'available',
                'message' => 'Cashier service initialized',
                'stripe_client' => $cashier ? 'initialized' : 'not initialized',
            ];
        } else {
            $diagnostics['connectivity']['cashier'] = [
                'status' => 'unavailable',
                'message' => 'Cashier class not found',
            ];
            $diagnostics['errors'][] = 'Laravel Cashier not installed';
        }
    } catch (\Exception $e) {
        $diagnostics['connectivity']['cashier'] = [
            'status' => 'error',
            'message' => 'Error checking Cashier',
            'error' => $e->getMessage(),
        ];
        $diagnostics['errors'][] = 'Cashier check error: '.$e->getMessage();
    }

    // Summary
    $diagnostics['summary'] = [
        'all_keys_configured' => ! empty(config('cashier.key')) && ! empty(config('cashier.secret')),
        'api_connectivity' => $diagnostics['connectivity']['api_test']['status'] ?? 'unknown',
        'has_errors' => ! empty($diagnostics['errors']),
        'error_count' => count($diagnostics['errors']),
    ];

    // Return JSON response
    return response()->json($diagnostics, 200, [], JSON_PRETTY_PRINT);
})->name('diagnostic.stripe');
