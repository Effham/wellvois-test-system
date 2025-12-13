<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\User;
use App\Services\UserTimezoneService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-users')->only(['index']);
        $this->middleware('permission:add-users')->only(['create', 'store']);
        $this->middleware('permission:update-users')->only(['edit', 'update', 'updateRole']);
        $this->middleware('permission:delete-users')->only(['destroy']);
    }

    /**
     * Display users listing with deferred loading support
     */
    public function index(Request $request)
    {
        Log::info('Central\UserController::index called', [
            'url' => $request->url(),
            'tenant' => tenancy()->tenant?->id ?? 'central',
            'tab' => $request->get('tab'),
        ]);

        // Check if this is a partial reload request (deferred data loading)
        $isPartialReload = (bool) $request->header('X-Inertia-Partial-Data');

        // Prepare filters
        $filters = [
            'search' => $request->get('search', ''),
            'perPage' => $request->get('perPage', 10),
        ];

        // Handle invitations tab in tenant context
        $tab = $request->get('tab');
        if ($tab === 'invitations' && tenancy()->initialized) {
            return $this->handleInvitationsTab($request, $filters, $isPartialReload);
        }

        // On initial load, return minimal data
        if (! $isPartialReload) {
            return Inertia::render('Users/Index', [
                'filters' => $filters,
                'users' => null,
                'roles' => null,
            ]);
        }

        // Return full data for partial reload
        $search = $request->get('search', '');
        $perPage = $request->get('perPage', 10);

        // Build query based on context
        $query = User::select('id', 'name', 'email', 'created_at')
            ->with('roles:id,name');

        // In central context, only show central-only users (not associated with any tenant)
        if (! tenancy()->initialized) {
            $query->whereDoesntHave('tenants')
                // Exclude users who are patients
                ->whereNotExists(function ($subQuery) {
                    $subQuery->select(DB::raw(1))
                        ->from('patients')
                        ->whereColumn('patients.user_id', 'users.id');
                })
                // Exclude users who are practitioners
                ->whereNotExists(function ($subQuery) {
                    $subQuery->select(DB::raw(1))
                        ->from('practitioners')
                        ->whereColumn('practitioners.user_id', 'users.id');
                });
        }
        // In tenant context, show all users (existing behavior)

        $query->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate($perPage)->withQueryString();

        // Transform users to include role information and archive permissions
        $users->getCollection()->transform(function ($user) {
            $user->role_name = $user->roles->first()?->name ?? 'No Role';
            $user->role_id = $user->roles->first()?->id;
            $user->can_be_archived = $user->canBeSoftDeleted();

            return $user;
        });

        $roles = Role::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('Users/Index', [
            'filters' => $filters,
            'users' => $users,
            'roles' => $roles,
        ]);
    }

    /**
     * Handle invitations tab data
     */
    protected function handleInvitationsTab(Request $request, array $filters, bool $isPartialReload)
    {
        // Only return invitations data for partial reloads
        if (! $isPartialReload) {
            return Inertia::render('Users/Index', [
                'invitations' => null,
                'users' => null,
                'roles' => null,
                'filters' => $filters,
            ]);
        }

        $search = $request->get('search', '');
        $perPage = $request->get('perPage', 10);

        $query = \App\Models\Tenant\Invitation::with(['role:id,name', 'inviter:id,name'])
            ->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('email', 'like', "%{$search}%");
            });
        }

        $invitations = $query->paginate($perPage);

        return Inertia::render('Users/Index', [
            'invitations' => $invitations,
            'users' => null,
            'roles' => null,
            'filters' => $filters,
        ]);
    }

    public function create()
    {
        $roles = Role::select('id', 'name')->get();

        return Inertia::render('Users/Invite', [
            'roles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        // Check if we're in a tenant context
        $currentTenant = tenancy()->tenant;

        if ($currentTenant) {
            Log::info('UserController::store - Starting user creation in tenant context', [
                'tenant_id' => $currentTenant->id,
                'tenant_name' => $currentTenant->name ?? 'N/A',
            ]);

            // Check if email exists in central database BEFORE validation
            $emailExists = false;
            tenancy()->central(function () use (&$emailExists, $request) {
                $emailExists = User::where('email', $request->input('email'))->exists();
            });

            // Scenario: Creating user from tenant context
            // Validate in tenant context (roles table is in tenant DB)
            // Password validation: Required if email doesn't exist, nullable if email exists
            // If email exists, password fields won't be shown in frontend, so password will be null/empty
            $passwordRules = $emailExists ? [
                'nullable', // Password not required if email exists (user will use existing password)
            ] : [
                'required',
                'confirmed',
                Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ];

            $validationRules = [
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'role' => 'required|string|exists:roles,name',
            ];

            // Add password validation rules based on email existence
            if ($emailExists) {
                // Email exists - password is not required (user will use existing password)
                $validationRules['password'] = 'nullable';
                $validationRules['password_confirmation'] = 'nullable';
            } else {
                // Email doesn't exist - password is required
                $validationRules['password'] = [
                    'required',
                    'confirmed',
                    Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
                ];
                $validationRules['password_confirmation'] = 'required';
            }

            $validated = $request->validate($validationRules);

            // Log::info('UserController::store - Validation passed', [
            //     'email' => $validated['email'],
            //     'role' => $validated['role'],
            // ]);

            // Use central connection for transaction since we're creating user in central DB
            DB::connection('central')->beginTransaction();
            // Log::info('UserController::store - Transaction started on central connection');

            try {
                $user = null;

                // Log::info('UserController::store - Entering tenancy()->central() closure');

                // Switch to central context and get or create user
                tenancy()->central(function () use (&$user, $validated, $currentTenant) {
                    // Check if email already exists in central database
                    $existingUser = User::where('email', $validated['email'])->first();

                    if ($existingUser) {
                        // User already exists - use existing user
                        // Don't update central user name (keep original)
                        // Name will be tenant-specific
                        $user = $existingUser;

                        // DON'T update password - user should use their existing password
                        // Password was not required/validated if email exists

                        // Check if user already exists in current tenant
                        tenancy()->initialize($currentTenant);
                        $tenantUserExists = User::where('email', $validated['email'])->exists();
                        tenancy()->end();

                        if ($tenantUserExists) {
                            throw new \Exception('A user with this email already exists in this tenant.');
                        }
                    } else {
                        // Create new user account in central database (NO ROLE ASSIGNED)
                        // Roles will be assigned in tenant database only
                        // Password is required for new users (validation ensures this)
                        $user = User::create([
                            'name' => $validated['name'],
                            'email' => $validated['email'],
                            'password' => Hash::make($validated['password']),
                        ]);
                    }

                    // Log::info('UserController::store - User created in central database', [
                    //     'user_id' => $user->id,
                    //     'user_email' => $user->email,
                    // ]);

                    // Log::info('UserController::store - Creating tenant_user relationship');

                    // Create tenant_user relationship if it doesn't exist
                    $tenantUserExists = DB::table('tenant_user')
                        ->where('user_id', $user->id)
                        ->where('tenant_id', $currentTenant->id)
                        ->exists();

                    if (! $tenantUserExists) {
                        DB::table('tenant_user')->insert([
                            'user_id' => $user->id,
                            'tenant_id' => $currentTenant->id,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }

                    // Log::info('UserController::store - tenant_user relationship created', [
                    //     'user_id' => $user->id,
                    //     'tenant_id' => $currentTenant->id,
                    // ]);
                });

                Log::info('UserController::store - Exited central context closure');

                DB::connection('central')->commit();
                Log::info('UserController::store - Transaction committed on central connection');

                Log::info('UserController::store - Starting ensureUserExistsInTenant', [
                    'user_id' => $user->id,
                    'tenant_id' => $currentTenant->id,
                    'role' => $validated['role'],
                ]);

                // Copy user to tenant database for SSO to work properly (after commit)
                // Pass tenant-specific name if user already existed (preserve tenant name)
                $this->ensureUserExistsInTenant($user, $currentTenant, $validated['role'], $validated['name'] ?? null);

                Log::info('UserController::store - User creation completed successfully', [
                    'user_id' => $user->id,
                ]);

                // Trigger consents for user creation
                app(\App\Services\ConsentTriggerService::class)->triggerConsentsForEntity('USER', 'creation', $user);

                // Show appropriate success message
                $successMessage = $emailExists
                    ? 'User added successfully! The user can login with their existing password.'
                    : 'User created successfully!';

                return redirect()->route('users.index')->with('success', $successMessage);

            } catch (\Exception $e) {
                DB::connection('central')->rollBack();

                Log::error('UserController::store - Exception caught', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'email' => $validated['email'] ?? null,
                    'tenant_id' => $currentTenant->id,
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]);

                return redirect()->back()
                    ->withErrors(['error' => $e->getMessage()])
                    ->withInput();
            }
        } else {
            // Scenario: Creating user from central context (no tenant)
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email',
                'password' => [
                    'required',
                    'confirmed',
                    Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
                ],
                'role' => 'required|string|exists:roles,name',
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
            ]);

            $user->assignRole($validated['role']);

            // Log role assignment
            \App\Listeners\RolePermissionActivityListener::logRoleAssigned($user, $validated['role']);

            return redirect()->route('users.index')->with('success', 'User created successfully!');
        }
    }

    public function destroy(User $user)
    {
        try {
            $user->delete(); // This will now check canBeSoftDeleted() and do soft delete

            return redirect()->route('users.index')->with('success', 'User archived successfully!');
        } catch (\Exception $e) {
            return redirect()->route('users.index')->with('error', $e->getMessage());
        }
    }

    /**
     * Display archived users
     */
    public function archived(Request $request)
    {
        $perPage = $request->get('perPage', 10);
        $search = $request->get('search');

        $query = User::onlyTrashed()->with('roles');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('deleted_at', 'desc')->paginate($perPage)->withQueryString();

        // Transform users to include role information
        $users->getCollection()->transform(function ($user) {
            $user->role_name = $user->roles->first()?->name ?? 'No Role';
            $user->role_id = $user->roles->first()?->id;

            return $user;
        });

        return Inertia::render('Users/Archived', [
            'users' => $users,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Restore an archived user
     */
    public function restore($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();

        return redirect()->route('users.archived')
            ->with('success', 'User restored successfully.');
    }

    /**
     * Permanently delete a user
     */
    public function forceDelete($id)
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->forceDelete();

        return redirect()->route('users.archived')
            ->with('success', 'User permanently deleted.');
    }

    public function edit(User $user)
    {
        $roles = Role::select('id', 'name')->get();
        $userRole = $user->roles()->pluck('name')->first();

        return Inertia::render('Users/Create', [
            'user' => $user,
            'roles' => $roles,
            'userRole' => $userRole,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
            'password' => [
                'nullable',
                'confirmed',
                Password::min(8)->letters()->mixedCase()->numbers()->symbols(),
            ],
            'role' => 'required|string|exists:roles,name',
        ]);

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'] ? Hash::make($validated['password']) : $user->password,
        ]);

        $oldRoles = $user->roles;
        $user->syncRoles([$validated['role']]);

        // Log role sync
        \App\Listeners\RolePermissionActivityListener::logRoleSynced($user, $oldRoles, [$validated['role']]);

        return redirect()->route('users.index')->with('success', 'User updated successfully!');
    }

    /**
     * Update user role only
     */
    public function updateRole(Request $request, User $user)
    {
        $validated = $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $role = Role::findOrFail($validated['role_id']);
        $oldRole = $user->roles->first()?->name ?? 'No Role';

        $user->syncRoles([$role->name]);

        // Log role change activity manually since syncRoles doesn't trigger model events
        if (auth()->user()) {
            activity()
                ->causedBy(auth()->user())
                ->performedOn($user)
                ->withProperties([
                    'old_role' => $oldRole,
                    'new_role' => $role->name,
                    'user_email' => $user->email,
                ])
                ->log("User role changed from '{$oldRole}' to '{$role->name}'");
        }

        return redirect()->back()->with('success', 'User role updated successfully!');
    }

    /**
     * Set user's browser timezone in session for central modules
     * Called by frontend when user logs in or accesses central modules
     */
    public function setTimezone(Request $request)
    {
        $validated = $request->validate([
            'timezone' => 'required|string|max:100',
        ]);

        UserTimezoneService::setUserTimezone($validated['timezone']);

        return response()->json([
            'success' => true,
            'timezone' => $validated['timezone'],
        ]);
    }

    /**
     * Ensure user exists in the tenant database for SSO to work properly
     */
    protected function ensureUserExistsInTenant(User $centralUser, Tenant $tenant, string $roleName, ?string $tenantSpecificName = null): void
    {
        Log::info('ensureUserExistsInTenant - Starting', [
            'central_user_id' => $centralUser->id,
            'central_user_email' => $centralUser->email,
            'tenant_id' => $tenant->id,
            'role_name' => $roleName,
        ]);

        try {
            Log::info('ensureUserExistsInTenant - Initializing tenant context');

            // Initialize tenant context
            tenancy()->initialize($tenant);

            Log::info('ensureUserExistsInTenant - Tenant context initialized', [
                'current_connection' => DB::getDefaultConnection(),
                'database' => DB::connection()->getDatabaseName(),
            ]);

            // Check if user already exists in tenant database
            Log::info('ensureUserExistsInTenant - Checking if user exists in tenant DB');
            $tenantUser = DB::table('users')
                ->where('email', $centralUser->email)
                ->first();

            Log::info('ensureUserExistsInTenant - User check result', [
                'user_exists' => $tenantUser !== null,
                'tenant_user_id' => $tenantUser->id ?? null,
            ]);

            if (! $tenantUser) {
                Log::info('ensureUserExistsInTenant - User does not exist, creating in tenant DB');

                // First, check if the ID is already taken by another user
                $existingUserWithId = DB::table('users')
                    ->where('id', $centralUser->id)
                    ->first();

                Log::info('ensureUserExistsInTenant - ID conflict check', [
                    'id_exists' => $existingUserWithId !== null,
                    'central_user_id' => $centralUser->id,
                ]);

                // Use tenant-specific name if provided, otherwise use central user name
                $userName = $tenantSpecificName ?? $centralUser->name;

                if ($existingUserWithId) {
                    Log::info('ensureUserExistsInTenant - ID conflict, creating without ID');
                    // If ID exists but different email, create without specifying ID (let auto-increment handle it)
                    // Use Eloquent model to trigger events (including wallet creation)
                    User::create([
                        'name' => $userName, // Use tenant-specific name
                        'email' => $centralUser->email,
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'created_at' => $centralUser->created_at,
                        'updated_at' => $centralUser->updated_at,
                    ]);
                    Log::info('ensureUserExistsInTenant - User created without ID');
                } else {
                    // Use Eloquent model to trigger events (including wallet creation)
                    // Try to create with same ID, fallback to auto-increment if needed
                    try {
                        Log::info('ensureUserExistsInTenant - Creating user with same ID');
                        User::forceCreate([
                            'id' => $centralUser->id,
                            'name' => $userName, // Use tenant-specific name
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                            'created_at' => $centralUser->created_at,
                            'updated_at' => $centralUser->updated_at,
                        ]);
                        Log::info('ensureUserExistsInTenant - User created with same ID successfully');
                    } catch (\Exception $e) {
                        Log::warning('ensureUserExistsInTenant - Failed to create with same ID, creating without ID', [
                            'error' => $e->getMessage(),
                        ]);
                        // If ID conflict, create without specifying ID
                        User::create([
                            'name' => $userName, // Use tenant-specific name
                            'email' => $centralUser->email,
                            'email_verified_at' => $centralUser->email_verified_at,
                            'password' => $centralUser->password,
                            'created_at' => $centralUser->created_at,
                            'updated_at' => $centralUser->updated_at,
                        ]);
                        Log::info('ensureUserExistsInTenant - User created without ID after conflict');
                    }
                }
            } else {
                Log::info('ensureUserExistsInTenant - User exists in tenant, updating password only');
                // Update password and email_verified_at to sync with central
                // But DO NOT update name - keep tenant-specific name
                DB::table('users')
                    ->where('email', $centralUser->email)
                    ->update([
                        'email_verified_at' => $centralUser->email_verified_at,
                        'password' => $centralUser->password,
                        'updated_at' => now(),
                    ]);
                Log::info('ensureUserExistsInTenant - User password and verification updated (name preserved)');
            }

            Log::info('ensureUserExistsInTenant - Fetching tenant user for role assignment');
            // Assign specified role to the user in tenant database
            $tenantUser = User::where('email', $centralUser->email)->first();

            Log::info('ensureUserExistsInTenant - Tenant user fetched', [
                'tenant_user_id' => $tenantUser->id ?? null,
                'tenant_user_email' => $tenantUser->email ?? null,
            ]);

            if ($tenantUser) {
                Log::info('ensureUserExistsInTenant - Checking if role exists in tenant DB', [
                    'role_name' => $roleName,
                ]);

                // Check if role exists in tenant database
                $role = Role::where('name', $roleName)->first();

                Log::info('ensureUserExistsInTenant - Role check result', [
                    'role_exists' => $role !== null,
                    'role_id' => $role->id ?? null,
                ]);

                if ($role) {
                    Log::info('ensureUserExistsInTenant - Assigning role to user');
                    // Assign the role to the user
                    $tenantUser->assignRole($role);

                    // Log role assignment
                    \App\Listeners\RolePermissionActivityListener::logRoleAssigned($tenantUser, $role);

                    Log::info('ensureUserExistsInTenant - Role assigned successfully', [
                        'tenant_id' => $tenant->id,
                        'user_id' => $tenantUser->id,
                        'user_email' => $tenantUser->email,
                        'role' => $roleName,
                    ]);
                } else {
                    Log::warning('ensureUserExistsInTenant - Role not found in tenant database', [
                        'tenant_id' => $tenant->id,
                        'user_id' => $tenantUser->id,
                        'user_email' => $tenantUser->email,
                        'role' => $roleName,
                    ]);
                }
            }

            Log::info('Successfully synced user to tenant database', [
                'tenant_id' => $tenant->id,
                'user_id' => $centralUser->id,
                'user_email' => $centralUser->email,
            ]);

        } catch (\Exception $e) {
            // Log error but don't fail the user creation process
            Log::error('Failed to sync user to tenant database', [
                'tenant_id' => $tenant->id,
                'user_id' => $centralUser->id,
                'user_email' => $centralUser->email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
        // NOTE: Do NOT call tenancy()->end() here because we're still in a tenant request
        // The session and other middleware need the tenant context to remain active
    }
}
