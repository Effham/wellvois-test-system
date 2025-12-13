<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-roles')->only(['index', 'show']);
        $this->middleware('permission:add-roles')->only(['create', 'store']);
        $this->middleware('permission:update-roles')->only(['edit', 'update']);
        $this->middleware('permission:delete-roles')->only('destroy');
    }

    public function index(Request $request)
    {
        $perPage = $request->get('perPage', 10);
        $search = $request->get('search');

        $query = Role::with(['permissions', 'users']);
        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $roles = $query->paginate($perPage)->withQueryString();

        // Add users count and is_protected info to each role
        $roles->getCollection()->transform(function ($role) {
            $role->users_count = $role->users()->count();

            return $role;
        });

        return Inertia::render('Roles/Index', [
            'roles' => $roles,
            'filters' => compact('search', 'perPage'),
        ]);
    }

    public function create()
    {
        $permissions = Permission::all()->map->only('id', 'name');
        $groupedPermissions = $permissions->groupBy(function ($permission) {
            $name = $permission['name'];

            // Handle "add-new-X" patterns
            if (str_starts_with($name, 'add-new-')) {
                return 'new-'.substr($name, 8); // Returns 'new-appointment', 'new-intake', 'new-note'
            }

            // Handle "view-new-menu"
            if ($name === 'view-new-menu') {
                return 'new-menu';
            }

            // Default: split on first hyphen
            $parts = explode('-', $name, 2);

            return count($parts) > 1 ? $parts[1] : $parts[0];
        });

        return Inertia::render('Roles/Create', [
            'groupedPermissions' => $groupedPermissions,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:roles,name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $data['name']]);
        if (! empty($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        // Log role creation
        \App\Listeners\RolePermissionActivityListener::logRoleCreated($role, $data['permissions'] ?? []);

        // Clear permission cache to ensure changes take effect immediately
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()->route('roles.index')
            ->with('success', 'Role created successfully.');
    }

    public function show(Role $role)
    {
        $role->load('permissions');

        return Inertia::render('Roles/Show', [
            'role' => $role,
        ]);
    }

    public function edit(Role $role)
    {
        // Prevent editing protected roles' names, but allow permission changes
        $permissions = Permission::all()->map->only('id', 'name');
        $role->load('permissions');
        $groupedPermissions = $permissions->groupBy(function ($permission) {
            $name = $permission['name'];

            // Handle "add-new-X" patterns
            if (str_starts_with($name, 'add-new-')) {
                return 'new-'.substr($name, 8); // Returns 'new-appointment', 'new-intake', 'new-note'
            }

            // Handle "view-new-menu"
            if ($name === 'view-new-menu') {
                return 'new-menu';
            }

            // Default: split on first hyphen
            $parts = explode('-', $name, 2);

            return count($parts) > 1 ? $parts[1] : $parts[0];
        });
        $assignedPermissions = $role->permissions->pluck('name')->toArray();

        return Inertia::render('Roles/Create', [
            'groupedPermissions' => $groupedPermissions,
            'role' => $role,
            'assignedPermissions' => $assignedPermissions,
        ]);
    }

    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles')->ignore($role->id),
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['exists:permissions,name'],
        ]);

        // Prevent changing name of protected roles
        if ($role->is_protected && $role->name !== $data['name']) {
            return redirect()->route('roles.index')
                ->with('error', 'Cannot change the name of a protected role.');
        }

        $changes = [];

        // Only update name if role is not protected
        if (! $role->is_protected && $role->name !== $data['name']) {
            $changes['name'] = ['old' => $role->name, 'new' => $data['name']];
            $role->update(['name' => $data['name']]);
        }

        // Validate that all permissions exist before syncing
        if (! empty($data['permissions'])) {
            $existingPermissions = \Spatie\Permission\Models\Permission::whereIn('name', $data['permissions'])->pluck('name')->toArray();
            $missingPermissions = array_diff($data['permissions'], $existingPermissions);

            if (! empty($missingPermissions)) {
                return redirect()->route('roles.index')
                    ->with('error', 'The following permissions do not exist: '.implode(', ', $missingPermissions));
            }
        }

        $oldPermissions = $role->permissions;
        $role->syncPermissions($data['permissions'] ?? []);

        // Log role updates
        if (! empty($changes)) {
            \App\Listeners\RolePermissionActivityListener::logRoleUpdated($role, $changes);
        }

        // Log permission changes
        \App\Listeners\RolePermissionActivityListener::logRolePermissionsSynced($role, $oldPermissions, $data['permissions'] ?? []);

        // Clear permission cache to ensure changes take effect immediately
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()->route('roles.index')
            ->with('success', 'Role updated successfully.');
    }

    public function destroy(Role $role)
    {
        // Check if role is protected (default system roles)
        if ($role->is_protected) {
            return redirect()->route('roles.index')
                ->with('error', 'This role is protected and cannot be deleted.');
        }

        // Check if role is assigned to any users
        $usersCount = $role->users()->count();
        if ($usersCount > 0) {
            return redirect()->route('roles.index')
                ->with('error', "Cannot delete role '{$role->name}' because it is assigned to {$usersCount} user(s). Please reassign the users to other roles first.");
        }

        // Log role deletion before deleting
        \App\Listeners\RolePermissionActivityListener::logRoleDeleted($role);

        $role->delete();

        // Clear permission cache to ensure changes take effect immediately
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()->route('roles.index')
            ->with('success', 'Role deleted successfully.');
    }
}
