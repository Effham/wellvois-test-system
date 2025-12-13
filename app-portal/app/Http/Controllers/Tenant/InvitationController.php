<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Mail\Tenant\UserInvitationMail;
use App\Models\Tenant;
use App\Models\Tenant\Invitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Session;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class InvitationController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:add-users')->only(['store', 'resend']);
        $this->middleware('permission:view-users')->only(['index']);
    }

    /**
     * Display invitations listing
     */
    public function index(Request $request)
    {
        $search = $request->get('search', '');
        $perPage = $request->get('perPage', 10);

        $query = Invitation::with(['role:id,name', 'inviter:id,name'])
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('email', 'like', "%{$search}%");
            });
        }

        $invitations = $query->paginate($perPage);

        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = $request->header('X-Inertia-Partial-Data');

        // On initial load or when called from Users/Index, return data for invitations tab
        if (! $isPartialReload && ! $request->has('search') && ! $request->has('perPage')) {
            // Return empty state for invitations tab (will be loaded via partial reload)
            return Inertia::render('Users/Index', [
                'invitations' => null,
                'users' => null,
                'roles' => null,
                'filters' => [
                    'search' => $search,
                    'perPage' => $perPage,
                ],
            ]);
        }

        // Return invitations data for partial reload
        return Inertia::render('Users/Index', [
            'invitations' => $invitations,
            'users' => null,
            'roles' => null,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Store a new invitation
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'role_id' => 'required|exists:roles,id',
        ]);

        $currentTenant = tenancy()->tenant;

        // Check if user already exists in this tenant
        $tenantUserExists = User::where('email', $validated['email'])->exists();
        if ($tenantUserExists) {
            return back()->withErrors(['email' => 'A user with this email already exists in this tenant.']);
        }

        // Server-side validation: Check if there's already a pending invitation for this email
        $existingPendingInvitation = Invitation::where('email', $validated['email'])
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->first();

        if ($existingPendingInvitation) {
            return back()->withErrors(['email' => 'An active invitation has already been sent to this email address. Please wait for it to expire or resend the existing invitation from the Invitations tab.']);
        }

        // Server-side validation: Also check for recently expired invitations (within last 24 hours)
        // to prevent spam, but allow after 24 hours
        $recentExpiredInvitation = Invitation::where('email', $validated['email'])
            ->where('status', 'pending')
            ->where('expires_at', '<=', now())
            ->where('expires_at', '>=', now()->subDay())
            ->first();

        if ($recentExpiredInvitation) {
            return back()->withErrors(['email' => 'An invitation was recently sent to this email address. Please wait 24 hours before sending a new invitation, or resend the existing one from the Invitations tab.']);
        }

        // Create invitation
        $invitation = Invitation::create([
            'email' => $validated['email'],
            'role_id' => $validated['role_id'],
            'token' => Invitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->addDays(7), // Invitation expires in 7 days
            'sent_at' => now(),
            'invited_by' => auth()->id(),
        ]);

        // Send invitation email
        try {
            Mail::to($validated['email'])->send(new UserInvitationMail($invitation));
        } catch (\Exception $e) {
            Log::error('Failed to send invitation email', [
                'invitation_id' => $invitation->id,
                'email' => $validated['email'],
                'error' => $e->getMessage(),
            ]);

            return back()->withErrors(['email' => 'Invitation created but failed to send email. Please try resending.']);
        }

        return redirect()->route('users.invitations.index')
            ->with('success', 'Invitation sent successfully.');
    }

    /**
     * Resend an invitation
     */
    public function resend(Invitation $invitation)
    {
        // Check if invitation can be resent
        if ($invitation->status === 'accepted') {
            return back()->withErrors(['error' => 'This invitation has already been accepted.']);
        }

        // Generate new token and extend expiration
        $invitation->update([
            'token' => Invitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
            'sent_at' => now(),
        ]);

        // Send invitation email
        try {
            Mail::to($invitation->email)->send(new UserInvitationMail($invitation));
        } catch (\Exception $e) {
            Log::error('Failed to resend invitation email', [
                'invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'error' => $e->getMessage(),
            ]);

            return back()->withErrors(['error' => 'Failed to resend invitation email.']);
        }

        return back()->with('success', 'Invitation resent successfully.');
    }

    /**
     * Show invitation acceptance page
     */
    public function show(Request $request, string $token)
    {
        $invitation = Invitation::with('role')->where('token', $token)->firstOrFail();

        if (! $invitation->canBeAccepted()) {
            if ($invitation->isExpired()) {
                $invitation->markAsExpired();
            }

            // Get tenant branding for error page too
            $tenant = tenancy()->tenant;
            $appearanceSettings = \App\Models\OrganizationSetting::getByPrefix('appearance_');
            $practiceDetails = \App\Models\OrganizationSetting::getByPrefix('practice_details_');

            $tenantName = $practiceDetails['practice_details_name'] ?? $tenant->company_name ?? 'Clinic';
            $themeColor = $appearanceSettings['appearance_theme_color'] ?? '#7c3aed';
            $logoPath = $appearanceSettings['appearance_logo_path'] ?? null;

            return Inertia::render('Users/AcceptInvitation', [
                'invitation' => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'token' => $invitation->token,
                    'role' => [
                        'id' => $invitation->role->id,
                        'name' => $invitation->role->name,
                    ],
                    'expires_at' => $invitation->expires_at->toIso8601String(),
                ],
                'emailExists' => false,
                'userName' => null,
                'tenantName' => $tenantName,
                'themeColor' => $themeColor,
                'logoPath' => $logoPath,
                'error' => 'This invitation has expired or is no longer valid.',
            ]);
        }

        // Check if user exists in central database and get their name
        $emailExists = false;
        $userName = null;
        tenancy()->central(function () use (&$emailExists, &$userName, $invitation) {
            $centralUser = User::where('email', $invitation->email)->first();
            if ($centralUser) {
                $emailExists = true;
                $userName = $centralUser->name;
            }
        });

        // Get tenant branding information
        $tenant = tenancy()->tenant;
        $appearanceSettings = \App\Models\OrganizationSetting::getByPrefix('appearance_');
        $practiceDetails = \App\Models\OrganizationSetting::getByPrefix('practice_details_');

        $tenantName = $practiceDetails['practice_details_name'] ?? $tenant->company_name ?? 'Clinic';
        $themeColor = $appearanceSettings['appearance_theme_color'] ?? '#7c3aed';
        $logoPath = $appearanceSettings['appearance_logo_path'] ?? null;

        return Inertia::render('Users/AcceptInvitation', [
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'token' => $invitation->token,
                'role' => [
                    'id' => $invitation->role->id,
                    'name' => $invitation->role->name,
                ],
                'expires_at' => $invitation->expires_at->toIso8601String(),
            ],
            'emailExists' => $emailExists,
            'userName' => $userName,
            'tenantName' => $tenantName,
            'themeColor' => $themeColor,
            'logoPath' => $logoPath,
        ]);
    }

    /**
     * Accept invitation
     */
    public function accept(Request $request, string $token)
    {
        $invitation = Invitation::with('role')->where('token', $token)->firstOrFail();

        if (! $invitation->canBeAccepted()) {
            return back()->withErrors(['error' => 'This invitation has expired or is no longer valid.']);
        }

        $currentTenant = tenancy()->tenant;

        // Check if user already exists in this tenant AND already has the role
        // If they exist but don't have the role, allow them to accept the invitation
        $tenantUser = User::where('email', $invitation->email)->first();
        if ($tenantUser && $tenantUser->hasRole($invitation->role->name)) {
            return back()->withErrors(['error' => 'You already have this role in this clinic.']);
        }

        // Validate based on whether user exists in central
        $emailExists = false;
        $userName = null;
        tenancy()->central(function () use (&$emailExists, &$userName, $invitation) {
            $centralUser = User::where('email', $invitation->email)->first();
            if ($centralUser) {
                $emailExists = true;
                $userName = $centralUser->name;
            }
        });

        $validationRules = [];

        if ($emailExists) {
            // User exists - no name or password needed (use existing name and password)
            $validationRules['name'] = 'nullable';
            $validationRules['password'] = 'nullable';
            $validationRules['password_confirmation'] = 'nullable';
        } else {
            // User doesn't exist - name and password required
            $validationRules['name'] = 'required|string|max:255';
            $validationRules['password'] = [
                'required',
                'confirmed',
                Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ];
            $validationRules['password_confirmation'] = 'required';
        }

        try {
            $validated = $request->validate($validationRules);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Invitation acceptance validation failed', [
                'invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'errors' => $e->errors(),
            ]);
            throw $e;
        }

        DB::connection('central')->beginTransaction();

        try {
            $centralUser = null;

            // Step 1: Ensure user exists in central database
            tenancy()->central(function () use (&$centralUser, $validated, $invitation, $emailExists) {
                if ($emailExists) {
                    // User exists - reuse (use existing name, don't update)
                    $centralUser = User::where('email', $invitation->email)->first();
                    Log::info('Invitation acceptance: Using existing central user', [
                        'user_id' => $centralUser->id,
                        'email' => $centralUser->email,
                    ]);
                } else {
                    // Create new user in central database
                    $centralUser = User::create([
                        'name' => $validated['name'],
                        'email' => $invitation->email,
                        'password' => Hash::make($validated['password']),
                    ]);
                    Log::info('Invitation acceptance: Created new central user', [
                        'user_id' => $centralUser->id,
                        'email' => $centralUser->email,
                    ]);
                }
            });

            if (! $centralUser) {
                throw new \Exception('Failed to create or retrieve central user.');
            }

            // Step 2: Create tenant user snapshot and assign role
            // Use existing name if user exists, otherwise use validated name
            $tenantSpecificName = $emailExists ? $userName : ($validated['name'] ?? null);

            Log::info('Invitation acceptance: Ensuring tenant user exists', [
                'central_user_id' => $centralUser->id,
                'tenant_id' => $currentTenant->id,
                'role' => $invitation->role->name,
            ]);

            $this->ensureUserExistsInTenant($centralUser, $currentTenant, $invitation->role->name, $tenantSpecificName ?? null);

            // Step 3: Ensure tenant_user pivot entry exists (tracking user-tenant relationship in central DB)
            tenancy()->central(function () use ($centralUser, $currentTenant) {
                $pivotExists = DB::table('tenant_user')
                    ->where('user_id', $centralUser->id)
                    ->where('tenant_id', $currentTenant->id)
                    ->exists();

                if (! $pivotExists) {
                    DB::table('tenant_user')->insert([
                        'user_id' => $centralUser->id,
                        'tenant_id' => $currentTenant->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    Log::info('Invitation acceptance: Created tenant_user pivot entry', [
                        'user_id' => $centralUser->id,
                        'tenant_id' => $currentTenant->id,
                    ]);
                } else {
                    Log::info('Invitation acceptance: tenant_user pivot entry already exists', [
                        'user_id' => $centralUser->id,
                        'tenant_id' => $currentTenant->id,
                    ]);
                }
            });

            // Mark invitation as accepted
            $invitation->markAsAccepted();

            DB::connection('central')->commit();

            Log::info('Invitation acceptance: Successfully completed all steps', [
                'central_user_id' => $centralUser->id,
                'tenant_id' => $currentTenant->id,
                'invitation_id' => $invitation->id,
            ]);

            // Log user in - ensure tenant is initialized
            tenancy()->initialize($currentTenant);
            $tenantUser = User::where('email', $invitation->email)->first();

            if (! $tenantUser) {
                throw new \Exception('Tenant user was not created successfully.');
            }

            // Log the user in
            Auth::login($tenantUser);

            // Regenerate session for security
            Session::regenerate();

            // Store login timestamp for absolute session timeout enforcement
            session(['login_time' => now()->timestamp]);

            // Set success flash message
            session()->flash('success', 'Invitation accepted successfully. Welcome!');

            Log::info('Invitation acceptance: User logged in successfully', [
                'tenant_user_id' => $tenantUser->id,
                'email' => $tenantUser->email,
                'tenant_id' => $currentTenant->id,
            ]);

            // Use Inertia::location for proper redirect handling (full page reload to establish session)
            return Inertia::location(route('dashboard'));

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::connection('central')->rollBack();
            throw $e;
        } catch (\Exception $e) {
            DB::connection('central')->rollBack();
            Log::error('Failed to accept invitation', [
                'invitation_id' => $invitation->id,
                'email' => $invitation->email,
                'tenant_id' => $currentTenant->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Provide more specific error messages
            $errorMessage = 'Failed to accept invitation. Please try again.';
            if (str_contains($e->getMessage(), 'duplicate') || str_contains($e->getMessage(), 'already exists')) {
                $errorMessage = 'A user with this email already exists in this clinic.';
            } elseif (str_contains($e->getMessage(), 'role') || str_contains($e->getMessage(), 'permission')) {
                $errorMessage = 'Unable to assign role. Please contact support.';
            } elseif (str_contains($e->getMessage(), 'not found')) {
                $errorMessage = 'Unable to complete invitation acceptance. Please contact support.';
            }

            return back()->withErrors(['error' => $errorMessage]);
        }
    }

    /**
     * Ensure user exists in tenant (copied from UserController)
     */
    protected function ensureUserExistsInTenant(User $centralUser, Tenant $tenant, string $roleName, ?string $tenantSpecificName = null): void
    {
        // Store current tenant context
        $previousTenant = tenancy()->tenant;

        tenancy()->initialize($tenant);

        try {
            $tenantUser = User::where('email', $centralUser->email)->first();

            if (! $tenantUser) {
                // Always create tenant user with auto-incrementing ID (don't use central user ID)
                $userName = $tenantSpecificName ?? $centralUser->name;

                $tenantUser = User::create([
                    'name' => $userName,
                    'email' => $centralUser->email,
                    'email_verified_at' => $centralUser->email_verified_at,
                    'password' => $centralUser->password,
                    'created_at' => $centralUser->created_at,
                    'updated_at' => $centralUser->updated_at,
                ]);

                Log::info('Invitation acceptance: Created tenant user with auto-increment ID', [
                    'tenant_user_id' => $tenantUser->id,
                    'central_user_id' => $centralUser->id,
                    'email' => $centralUser->email,
                ]);
            }

            // Verify tenant user was created/found
            if (! $tenantUser) {
                $tenantUser = User::where('email', $centralUser->email)->first();
            }

            if (! $tenantUser) {
                throw new \Exception('Failed to create tenant user. User was not found after creation.');
            }

            // Assign role
            $role = Role::where('name', $roleName)->first();
            if (! $role) {
                throw new \Exception("Role '{$roleName}' not found in tenant database.");
            }

            if (! $tenantUser->hasRole($roleName)) {
                $tenantUser->assignRole($roleName);
                Log::info('Invitation acceptance: Assigned role to tenant user', [
                    'tenant_user_id' => $tenantUser->id,
                    'role' => $roleName,
                ]);
            } else {
                Log::info('Invitation acceptance: Tenant user already has role', [
                    'tenant_user_id' => $tenantUser->id,
                    'role' => $roleName,
                ]);
            }

            // Note: tenant_user pivot entry is now handled in the accept() method
            // to ensure it's part of the central transaction
        } finally {
            // Restore previous tenant context if it existed
            if ($previousTenant) {
                tenancy()->initialize($previousTenant);
            } else {
                tenancy()->end();
            }
        }
    }
}
