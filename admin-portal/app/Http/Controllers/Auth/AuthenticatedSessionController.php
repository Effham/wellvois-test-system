<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Mail\UserSessionActivityMail;
use App\Models\Tenant;
use App\Models\Tenant\PatientInvitation;
use App\Models\User;
use App\Services\GlobalLogoutService;
use App\Services\TenantSessionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the intent selector page.
     */
    public function selectIntent(Request $request): Response
    {
        return Inertia::render('auth/intent-selector', [
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Show the login page (practitioner or patient).
     */
    public function create(Request $request): Response|RedirectResponse
    {
        // Get intent from route defaults, query parameter, or route name
        $intent = $request->route()->defaults['intent']
            ?? $request->query('intent')
            ?? null;

        // If no intent, try to determine from route name
        if (! $intent) {
            $routeName = $request->route()->getName();
            if ($routeName === 'login.practitioner') {
                $intent = 'practitioner';
            } elseif ($routeName === 'login.patient') {
                $intent = 'patient';
            }
        }

        // Validate intent - redirect to intent selector if invalid
        if (! in_array($intent, ['practitioner', 'patient'])) {
            return redirect()->route('login.intent');
        }

        // Check for intended URL from document access (query parameter from tenant domain)
        if ($request->has('intended')) {
            session(['intended' => $request->query('intended')]);
        }

        // Check for document access token (passed from tenant domain)
        if ($request->has('document_access_token')) {
            session(['document_access_token' => $request->query('document_access_token')]);
        }

        // Store intent in session for use during authentication
        session(['login_intent' => $intent]);

        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
            'tenant' => tenant('company_name') ?? Str::title(tenant('id')) ?? null,
            'intent' => $intent,
        ]);
    }

    /**
     * Show the admin login page.
     */
    public function createAdmin(Request $request): Response
    {
        // Check for intended URL from document access
        if ($request->has('intended')) {
            session(['intended' => $request->query('intended')]);
        }

        // Check for document access token
        if ($request->has('document_access_token')) {
            session(['document_access_token' => $request->query('document_access_token')]);
        }

        // Store admin intent in session
        session(['login_intent' => 'admin']);

        return Inertia::render('auth/admin-login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request (practitioner/patient).
     */
    public function store(LoginRequest $request)
    {
        // Get intent from session or request
        $intent = session('login_intent') ?? $request->input('intent');

        // Validate intent for practitioner/patient login
        if (! in_array($intent, ['practitioner', 'patient'])) {
            return redirect()->route('login.intent')
                ->withErrors(['intent' => 'Please select a login type.']);
        }

        $request->authenticate();
        Session::regenerate();

        // Store login timestamp for absolute session timeout enforcement
        session(['login_time' => now()->timestamp]);

        $user = Auth::user();
        Mail::to($user->email)->send(
            new UserSessionActivityMail($user, 'login', now())
        );

        // Check if 2FA is enabled for the user and not already passed in this session
        if ($user->google2fa_enabled && ! session('2fa_passed')) {
            // Store user ID and intent in session temporarily before 2FA verification
            session(['2fa_user_id' => $user->id]);
            session(['login_intent' => $intent]); // Preserve intent for after 2FA

            return redirect()->route('two-factor-authentication.challenge');
        }

        // Clear global logout flag when user logs in
        $globalLogoutService = app(GlobalLogoutService::class);
        $globalLogoutService->clearGlobalLogoutFlag($user->email);

        // STRICT VALIDATION: User MUST have a record in the respective table
        $practitionerRecord = \App\Models\Practitioner::where('user_id', $user->id)->first();
        $patientRecord = \App\Models\Patient::where('user_id', $user->id)->first();

        if ($intent === 'practitioner') {
            // STRICT: Must have practitioner record - no exceptions
            if (! $practitionerRecord) {
                Auth::logout();
                Session::invalidate();
                Session::regenerateToken();
                session()->forget('login_intent');

                // Redirect back to practitioner login page with error
                return redirect()->route('login.practitioner')
                    ->withErrors(['email' => 'This account is not registered as a practitioner. Please use the admin login if you are staff or administrator.']);
            }
        }

        if ($intent === 'patient') {
            // STRICT: Must have patient record - no exceptions
            if (! $patientRecord) {
                Auth::logout();
                Session::invalidate();
                Session::regenerateToken();
                session()->forget('login_intent');

                // Redirect back to patient login page with error
                return redirect()->route('login.patient')
                    ->withErrors(['email' => 'This account is not registered as a patient. Please use the admin login if you are staff or administrator.']);
            }
        }

        // Clear intent from session after validation
        session()->forget('login_intent');

        // Check for intended URL (e.g., from document access link)
        if (session()->has('intended')) {
            $intendedUrl = session('intended');

            // Mark document access token as used if present
            $documentIdsFilter = null;
            if (session()->has('document_access_token')) {
                $token = session('document_access_token');
                $tokenService = app(\App\Services\DocumentAccessTokenService::class);

                // Get token data to extract document IDs before marking as used
                $tokenData = $tokenService->validateToken($token);
                if ($tokenData && ! empty($tokenData['document_ids'])) {
                    $documentIdsFilter = $tokenData['document_ids'];
                    session(['document_ids_filter' => $documentIdsFilter]);
                    // Log::info('📄 Document IDs extracted from token for SSO', [
                    //     'document_ids' => $documentIdsFilter,
                    //     'user_id' => $user->id,
                    // ]);
                }

                $tokenService->markTokenAsUsed($token);
                session()->forget('document_access_token');
            }

            session()->forget('intended');

            // Parse the intended URL to check if it's a tenant URL
            $parsedUrl = parse_url($intendedUrl);
            $host = $parsedUrl['host'] ?? '';
            $path = $parsedUrl['path'] ?? '/dashboard';

            // Check if this is a tenant domain (not central domain)
            $centralDomains = config('tenancy.central_domains', []);
            $isTenantUrl = ! in_array($host, $centralDomains);

            if ($isTenantUrl) {
                // Find tenant by domain
                $tenant = \App\Models\Tenant::whereHas('domains', function ($query) use ($host) {
                    $query->where('domain', $host);
                })->first();

                if ($tenant) {
                    // Use SSO to authenticate user on tenant domain
                    $tenantSessionService = app(\App\Services\TenantSessionService::class);
                    $ssoService = app(\App\Services\SecureSSOService::class);
                    $code = $ssoService->generateSSOCode($user, $tenant, $path, null, $documentIdsFilter);
                    $ssoUrl = $ssoService->generateTenantSSOUrl($code, $tenant);

                    return Inertia::location($ssoUrl);
                }
            }

            // If not a tenant URL or tenant not found, do regular redirect
            return redirect($intendedUrl);
        }

        // Intent-based redirects for practitioner/patient login
        // Practitioner/Patient users ALWAYS go to central dashboard (not tenant-specific)
        $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
        $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();

        if ($intent === 'practitioner' && $isPractitioner) {
            // Practitioner login → Central Practitioner Dashboard
            return redirect()->route('central.practitioner-dashboard');
        }

        if ($intent === 'patient' && $isPatient) {
            // Patient login → Central Patient Dashboard
            return redirect()->route('central.patient-dashboard');
        }

        // This should not happen due to validation above, but fallback
        return redirect()->route('login.intent')
            ->withErrors(['email' => 'Invalid login attempt.']);
    }

    public function redirectToTenant($tenant, $user)
    {
        $tenantSessionService = app(TenantSessionService::class);
        $url = $tenantSessionService->switchToTenant($user, $tenant);

        return Inertia::location($url);
    }

    public function redirectToTenantWithRedirect($tenant, $user, $redirectPath = '/dashboard')
    {
        $tenantSessionService = app(TenantSessionService::class);
        $url = $tenantSessionService->switchToTenant($user, $tenant, $redirectPath);

        return Inertia::location($url);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request)
    {
        // Use global logout service for comprehensive logout
        $globalLogoutService = app(GlobalLogoutService::class);
        $globalLogoutService->performGlobalLogout($request);

        // Check if logout is from public portal
        if ($request->has('from_public_portal') && $request->input('from_public_portal') === 'true') {
            return Inertia::location(route('public-portal.index'));
        }

        // Default redirect to intent selector page with full page reload
        return Inertia::location(route('login.intent'));
    }

    public function showPatientRegistration($token)
    {
        $invitationTenant = null;
        $invitation = null;

        tenancy()->central(function () use (&$invitation, &$invitationTenant, $token) {
            $invitationTenant = Tenant::all()->first(function ($tenant) use (&$invitation, $token) {
                tenancy()->initialize($tenant);
                $found = PatientInvitation::where('token', $token)
                    ->where('expires_at', '>=', now())
                    ->where('status', 'pending')
                    ->first();
                tenancy()->end();

                if ($found) {
                    $invitation = $found;

                    return true;
                }

                return false;
            });
        });

        if (! $invitation) {
            abort(404, 'Invalid or expired invitation.');
        }

        // Ensure invitation tenant was resolved
        if ($invitationTenant === null) {
            abort(404, 'Invalid or expired invitation.');
        }

        // Pass tenant ID or domain for later use
        return Inertia::render('auth/PatientRegister', [
            'email' => $invitation->email,
            'tenant_id' => $invitationTenant->id,
            'token' => $token,
        ]);
    }

    public function registerPatient(Request $request, $token)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required|string|min:8',
        ]);

        // Find tenant and initialize tenancy
        $tenant = Tenant::findOrFail($request->tenant_id);
        tenancy()->initialize($tenant);

        // Find invitation in tenant database
        $invitation = PatientInvitation::where('token', $token)
            ->where('expires_at', '>=', now())
            ->where('status', 'pending')
            ->firstOrFail();

        $user = User::create([
            'name' => $request->name,
            'email' => $invitation->email,
            'password' => bcrypt($request->password),
        ]);

        $patientRole = Role::firstOrCreate(['name' => 'Patient']);

        if ($user) {
            $user->assignRole($patientRole);
        }

        // Mark invitation as accepted
        $invitation->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        tenancy()->end();

        // Create user in central database
        tenancy()->central(function () use ($request, $invitation, $tenant) {
            $centralUser = User::updateOrCreate(
                ['email' => $invitation->email],
                [
                    'name' => $request->name,
                    'password' => bcrypt($request->password),
                ]
            );

            // Link central user to tenant
            $centralUser->tenants()->syncWithoutDetaching([$tenant->id]);
        });

        // Redirect to intent selector page
        return redirect()->route('login.intent')->with('success', 'Account created successfully. Please log in.');
    }

    /**
     * Handle an incoming admin authentication request.
     */
    public function storeAdmin(LoginRequest $request)
    {
        $request->authenticate();
        Session::regenerate();

        // Store login timestamp for absolute session timeout enforcement
        session(['login_time' => now()->timestamp]);

        $user = Auth::user();
        Mail::to($user->email)->send(
            new UserSessionActivityMail($user, 'login', now())
        );

        // Check if 2FA is enabled for the user and not already passed in this session
        if ($user->google2fa_enabled && ! session('2fa_passed')) {
            // Store user ID in session temporarily before 2FA verification
            session(['2fa_user_id' => $user->id]);
            session(['login_intent' => 'admin']); // Preserve admin intent for after 2FA

            return redirect()->route('two-factor-authentication.challenge');
        }

        // Clear global logout flag when user logs in
        $globalLogoutService = app(GlobalLogoutService::class);
        $globalLogoutService->clearGlobalLogoutFlag($user->email);

        // Admin login: NO requirement for practitioner/patient table entries
        // Users can be practitioners in one tenant and regular users in another
        // Check if user is a practitioner (for role assignment in tenants)
        $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
        $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();

        // Block pure patients from admin login (they should use patient login)
        // But allow practitioners (they can be practitioners in one tenant, users in another)
        if ($isPatient && ! $isPractitioner) {
            Auth::logout();
            Session::invalidate();
            Session::regenerateToken();
            session()->forget('login_intent');

            return redirect()->route('admin.login')
                ->withErrors(['email' => 'This account is registered as a patient. Please use the patient login page.']);
        }

        // Clear intent from session
        session()->forget('login_intent');

        // Check for intended URL (e.g., from document access link)
        if (session()->has('intended')) {
            $intendedUrl = session('intended');

            // Mark document access token as used if present
            $documentIdsFilter = null;
            if (session()->has('document_access_token')) {
                $token = session('document_access_token');
                $tokenService = app(\App\Services\DocumentAccessTokenService::class);

                // Get token data to extract document IDs before marking as used
                $tokenData = $tokenService->validateToken($token);
                if ($tokenData && ! empty($tokenData['document_ids'])) {
                    $documentIdsFilter = $tokenData['document_ids'];
                    session(['document_ids_filter' => $documentIdsFilter]);
                }

                $tokenService->markTokenAsUsed($token);
                session()->forget('document_access_token');
            }

            session()->forget('intended');

            // Parse the intended URL to check if it's a tenant URL
            $parsedUrl = parse_url($intendedUrl);
            $host = $parsedUrl['host'] ?? '';
            $path = $parsedUrl['path'] ?? '/dashboard';

            // Check if this is a tenant domain (not central domain)
            $centralDomains = config('tenancy.central_domains', []);
            $isTenantUrl = ! in_array($host, $centralDomains);

            if ($isTenantUrl) {
                // Find tenant by domain
                $tenant = \App\Models\Tenant::whereHas('domains', function ($query) use ($host) {
                    $query->where('domain', $host);
                })->first();

                if ($tenant) {
                    // Ensure user exists in tenant and has proper roles
                    $this->ensureAdminUserInTenant($user, $tenant, $isPractitioner);

                    // Use SSO to authenticate user on tenant domain
                    $tenantSessionService = app(\App\Services\TenantSessionService::class);
                    $ssoService = app(\App\Services\SecureSSOService::class);
                    $code = $ssoService->generateSSOCode($user, $tenant, $path, null, $documentIdsFilter);
                    $ssoUrl = $ssoService->generateTenantSSOUrl($code, $tenant);

                    return Inertia::location($ssoUrl);
                }
            }

            // If not a tenant URL or tenant not found, do regular redirect
            return redirect($intendedUrl);
        }

        // Admin login flow: Check all tenants user is part of using tenant_user pivot table
        // Get user email and find central user ID
        $userEmail = $user->email;
        $centralUser = \App\Models\User::where('email', $userEmail)->first();

        if (! $centralUser) {
            // Fallback: use current user ID if not found by email
            $centralUserId = $user->id;
        } else {
            $centralUserId = $centralUser->id;
        }

        // Query tenant_user pivot table directly to get all tenant IDs
        $tenantIds = \Illuminate\Support\Facades\DB::connection('central')
            ->table('tenant_user')
            ->where('user_id', $centralUserId)
            ->pluck('tenant_id')
            ->toArray();

        // Load all tenants
        $allTenants = \App\Models\Tenant::whereIn('id', $tenantIds)
            ->with('domains')
            ->get();

        $tenantCount = $allTenants->count();

        // No tenant: central-only admin → central dashboard
        if ($tenantCount === 0) {
            return redirect()->route('central.dashboard');
        }

        // Multiple tenants: show tenant selection
        if ($tenantCount > 1) {
            return redirect()->route('tenant.selection');
        }

        // One tenant: redirect directly to that tenant
        $tenant = $allTenants->first();

        // Ensure user exists in tenant and has proper roles
        $this->ensureAdminUserInTenant($user, $tenant, $isPractitioner);

        // Check if tenant requires billing setup before allowing access
        if ($tenant->requiresBilling()) {
            return redirect()->route('billing.setup', [])
                ->with('warning', 'Please complete your subscription setup to access your workspace.');
        }

        return $this->redirectToTenant($tenant, $user);
    }

    /**
     * Get tenants filtered by role based on login intent
     *
     * @param  User  $user  The central user
     * @param  string  $intent  Login intent: 'admin' or 'practitioner'
     * @return array Array with 'tenants' (filtered list) and 'count' (count of filtered tenants)
     */
    protected function getTenantsByIntent(User $user, string $intent): array
    {
        $allTenants = $user->tenants()->with('domains')->get();

        if ($intent === 'admin') {
            // For admin login: Filter tenants where user has Admin or Staff role (not Practitioner-only)
            $adminTenants = collect();

            foreach ($allTenants as $tenant) {
                tenancy()->initialize($tenant);

                try {
                    $tenantUser = User::where('email', $user->email)->first();

                    if ($tenantUser) {
                        // Check if user has Admin or Staff role (not just Practitioner)
                        $hasAdminRole = $tenantUser->hasRole('Admin') || $tenantUser->hasRole('Staff');
                        $hasOnlyPractitionerRole = $tenantUser->hasRole('Practitioner') &&
                                                   $tenantUser->roles->count() === 1;

                        // Include tenant if user has admin/staff role, OR if user has no roles (will get Admin assigned)
                        if ($hasAdminRole || ($tenantUser->roles->isEmpty() && ! $hasOnlyPractitionerRole)) {
                            $adminTenants->push($tenant);
                        }
                    } else {
                        // User doesn't exist in tenant yet - will be created with Admin role
                        $adminTenants->push($tenant);
                    }
                } finally {
                    tenancy()->end();
                }
            }

            // If no admin tenants found, fall back to all tenants (user might be regular user)
            if ($adminTenants->isEmpty()) {
                return [
                    'tenants' => $allTenants,
                    'count' => $allTenants->count(),
                ];
            }

            return [
                'tenants' => $adminTenants,
                'count' => $adminTenants->count(),
            ];
        }

        if ($intent === 'practitioner') {
            // For practitioner login: Filter tenants where user is a practitioner
            // Check central practitioners table - practitioners can access all their tenants
            $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();

            if ($isPractitioner) {
                // Practitioner can access all tenants they're part of
                return [
                    'tenants' => $allTenants,
                    'count' => $allTenants->count(),
                ];
            }

            // Not a practitioner - return empty
            return [
                'tenants' => collect(),
                'count' => 0,
            ];
        }

        // Default: return all tenants
        return [
            'tenants' => $allTenants,
            'count' => $allTenants->count(),
        ];
    }

    /**
     * Ensure admin user exists in tenant with proper roles
     * If user is a practitioner, assign Practitioner role in tenant
     * Otherwise, ensure they have appropriate admin/staff roles
     */
    protected function ensureAdminUserInTenant(User $centralUser, Tenant $tenant, bool $isPractitioner): void
    {
        try {
            // Initialize tenant context
            tenancy()->initialize($tenant);

            // In tenant context, User model refers to tenant User
            // Check if user exists in tenant database
            $tenantUser = User::where('email', $centralUser->email)->first();

            if (! $tenantUser) {
                // Create tenant user
                $existingUserWithId = User::where('id', $centralUser->id)->first();

                if ($existingUserWithId) {
                    // ID conflict, create without ID
                    $tenantUser = User::create([
                        'name' => $centralUser->name,
                        'email' => $centralUser->email,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                    ]);
                } else {
                    // Try to create with same ID
                    try {
                        $tenantUser = User::forceCreate([
                            'id' => $centralUser->id,
                            'name' => $centralUser->name,
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                        ]);
                    } catch (\Exception $e) {
                        // Fallback to auto-increment
                        $tenantUser = User::create([
                            'name' => $centralUser->name,
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                        ]);
                    }
                }
            } else {
                // Update password and email_verified_at to sync with central
                // But DO NOT update name - keep tenant-specific name
                $tenantUser->update([
                    'email_verified_at' => $centralUser->email_verified_at,
                    'password' => $centralUser->password,
                    'updated_at' => now(),
                ]);
            }

            // Assign roles based on user type
            // IMPORTANT: Roles are stored in tenant database, so roles can differ per tenant
            if ($isPractitioner) {
                // If practitioner, assign Practitioner role in tenant
                // Practitioners get: Role permissions + Practitioner-specific access
                $practitionerRole = Role::firstOrCreate(['name' => 'Practitioner']);
                if (! $tenantUser->hasRole('Practitioner')) {
                    $tenantUser->assignRole($practitionerRole);
                }
            } else {
                // For admin/staff, ensure they have Admin role if no other role assigned
                // Admin users can have different roles in different tenants
                if ($tenantUser->roles->isEmpty()) {
                    $adminRole = Role::firstOrCreate(['name' => 'Admin']);
                    $tenantUser->assignRole($adminRole);
                }
            }

            // Ensure tenant_user pivot relationship exists
            tenancy()->central(function () use ($centralUser, $tenant) {
                if (! $centralUser->tenants()->where('tenant_id', $tenant->id)->exists()) {
                    $centralUser->tenants()->attach($tenant->id);
                }
            });

        } catch (\Exception $e) {
            Log::error('Failed to ensure admin user in tenant', [
                'central_user_id' => $centralUser->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - let the flow continue
        }
    }

    public function redirectAfterAuth(User $user)
    {
        // Get intent from session (preserved from login)
        $intent = session('login_intent');

        // Clear global logout flag when user logs in
        app(GlobalLogoutService::class)->clearGlobalLogoutFlag($user->email);

        // Clear intent from session after use
        session()->forget('login_intent');

        // Handle admin intent (from 2FA completion)
        if ($intent === 'admin') {
            // Admin login: Prioritize tenants where user has Admin/Staff role
            $tenantResult = $this->getTenantsByIntent($user, 'admin');
            $tenants = $tenantResult['tenants'];
            $tenantCount = $tenantResult['count'];

            // No tenant: central-only admin → central dashboard
            if ($tenantCount === 0) {
                return redirect()->route('central.dashboard');
            }

            // Multiple admin/staff tenants: show tenant selection
            if ($tenantCount > 1) {
                return redirect()->route('tenant.selection');
            }

            // One admin/staff tenant: redirect directly to that tenant
            $tenant = $tenants->first();

            // Check if user is a practitioner (for role assignment)
            $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
            $this->ensureAdminUserInTenant($user, $tenant, $isPractitioner);

            // Check if tenant requires billing setup
            if ($tenant->requiresBilling()) {
                return redirect()->route('billing.setup', [])
                    ->with('warning', 'Please complete your subscription setup to access your workspace.');
            }

            return $this->redirectToTenant($tenant, $user);
        }

        // Handle practitioner/patient intent (from 2FA completion)
        if (in_array($intent, ['practitioner', 'patient'])) {
            $isPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->exists();
            $isPatient = \App\Models\Patient::where('user_id', $user->id)->exists();

            // Validate user type matches intent
            if ($intent === 'practitioner' && ! $isPractitioner) {
                Auth::logout();
                Session::invalidate();
                Session::regenerateToken();

                // Redirect back to practitioner login page with error
                return redirect()->route('login.practitioner')
                    ->withErrors(['email' => 'This account is not registered as a practitioner. Please use the admin login if you are staff or administrator.']);
            }

            if ($intent === 'patient' && ! $isPatient) {
                Auth::logout();
                Session::invalidate();
                Session::regenerateToken();

                // Redirect back to patient login page with error
                return redirect()->route('login.patient')
                    ->withErrors(['email' => 'This account is not registered as a patient. Please use the admin login if you are staff or administrator.']);
            }

            // Practitioner login: Check tenant relationships
            if ($intent === 'practitioner' && $isPractitioner) {
                $tenantResult = $this->getTenantsByIntent($user, 'practitioner');
                $tenants = $tenantResult['tenants'];
                $tenantCount = $tenantResult['count'];

                if ($tenantCount === 0) {
                    // No tenants - go to central dashboard
                    return redirect()->route('central.practitioner-dashboard');
                }

                if ($tenantCount === 1) {
                    // One tenant: redirect directly to that tenant's dashboard
                    $tenant = $tenants->first();
                    $this->ensureAdminUserInTenant($user, $tenant, true);

                    // Check if tenant requires billing setup
                    if ($tenant->requiresBilling()) {
                        return redirect()->route('billing.setup', [])
                            ->with('warning', 'Please complete your subscription setup to access your workspace.');
                    }

                    return $this->redirectToTenant($tenant, $user);
                }

                // Multiple tenants: show tenant selection for practitioners
                return redirect()->route('tenant.selection');
            }

            // Patient login → Central Patient Dashboard (no tenant selection for patients)
            if ($intent === 'patient' && $isPatient) {
                return redirect()->route('central.patient-dashboard');
            }
        }

        // Fallback: Should not reach here, but handle gracefully
        return redirect()->route('login.intent')
            ->withErrors(['email' => 'Invalid login attempt.']);
    }
}
