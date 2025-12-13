<?php

namespace App\Listeners;

use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionActivityListener
{
    /**
     * Log role assignment to user
     */
    public static function logRoleAssigned($user, $role, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();

        activity()
            ->causedBy($causer)
            ->performedOn($user)
            ->event('role_assigned')
            ->withProperties([
                'role_name' => is_string($role) ? $role : $role->name,
                'role_id' => is_string($role) ? null : $role->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$role}' assigned to user {$user->name}");
    }

    /**
     * Log role removal from user
     */
    public static function logRoleRemoved($user, $role, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $roleName = is_string($role) ? $role : $role->name;

        activity()
            ->causedBy($causer)
            ->performedOn($user)
            ->event('role_removed')
            ->withProperties([
                'role_name' => $roleName,
                'role_id' => is_string($role) ? null : $role->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$roleName}' removed from user {$user->name}");
    }

    /**
     * Log role sync (multiple roles changed at once)
     */
    public static function logRoleSynced($user, $oldRoles, $newRoles, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $oldRoleNames = is_array($oldRoles) ? $oldRoles : $oldRoles->pluck('name')->toArray();
        $newRoleNames = is_array($newRoles) ? $newRoles : (is_string($newRoles) ? [$newRoles] : [$newRoles->name]);

        activity()
            ->causedBy($causer)
            ->performedOn($user)
            ->event('roles_synced')
            ->withProperties([
                'old_roles' => $oldRoleNames,
                'new_roles' => $newRoleNames,
                'added_roles' => array_diff($newRoleNames, $oldRoleNames),
                'removed_roles' => array_diff($oldRoleNames, $newRoleNames),
                'user_email' => $user->email,
                'user_name' => $user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("User {$user->name} roles synced from [".implode(', ', $oldRoleNames).'] to ['.implode(', ', $newRoleNames).']');
    }

    /**
     * Log permission granted directly to user
     */
    public static function logPermissionGranted($user, $permission, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $permissionName = is_string($permission) ? $permission : $permission->name;

        activity()
            ->causedBy($causer)
            ->performedOn($user)
            ->event('permission_granted')
            ->withProperties([
                'permission_name' => $permissionName,
                'permission_id' => is_string($permission) ? null : $permission->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Permission '{$permissionName}' granted to user {$user->name}");
    }

    /**
     * Log permission revoked from user
     */
    public static function logPermissionRevoked($user, $permission, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $permissionName = is_string($permission) ? $permission : $permission->name;

        activity()
            ->causedBy($causer)
            ->performedOn($user)
            ->event('permission_revoked')
            ->withProperties([
                'permission_name' => $permissionName,
                'permission_id' => is_string($permission) ? null : $permission->id,
                'user_email' => $user->email,
                'user_name' => $user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Permission '{$permissionName}' revoked from user {$user->name}");
    }

    /**
     * Log permissions synced to role
     */
    public static function logRolePermissionsSynced(Role $role, $oldPermissions, $newPermissions, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $oldPermissionNames = is_array($oldPermissions) ? $oldPermissions : $oldPermissions->pluck('name')->toArray();
        $newPermissionNames = is_array($newPermissions) ? $newPermissions : array_map(fn ($p) => is_string($p) ? $p : $p->name, $newPermissions);

        activity()
            ->causedBy($causer)
            ->performedOn($role)
            ->event('role_permissions_synced')
            ->withProperties([
                'role_name' => $role->name,
                'role_id' => $role->id,
                'old_permissions' => $oldPermissionNames,
                'new_permissions' => $newPermissionNames,
                'added_permissions' => array_diff($newPermissionNames, $oldPermissionNames),
                'removed_permissions' => array_diff($oldPermissionNames, $newPermissionNames),
                'permissions_count' => count($newPermissionNames),
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$role->name}' permissions synced - ".count($newPermissionNames).' permissions assigned');
    }

    /**
     * Log role created
     */
    public static function logRoleCreated(Role $role, array $permissions = [], $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();
        $permissionNames = array_map(fn ($p) => is_string($p) ? $p : $p->name, $permissions);

        activity()
            ->causedBy($causer)
            ->performedOn($role)
            ->event('role_created')
            ->withProperties([
                'role_name' => $role->name,
                'role_id' => $role->id,
                'permissions' => $permissionNames,
                'permissions_count' => count($permissionNames),
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$role->name}' created with ".count($permissionNames).' permissions');
    }

    /**
     * Log role updated
     */
    public static function logRoleUpdated(Role $role, array $changes, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();

        activity()
            ->causedBy($causer)
            ->performedOn($role)
            ->event('role_updated')
            ->withProperties([
                'role_name' => $role->name,
                'role_id' => $role->id,
                'changes' => $changes,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$role->name}' updated");
    }

    /**
     * Log role deleted
     */
    public static function logRoleDeleted(Role $role, $performedBy = null): void
    {
        $causer = $performedBy ?? Auth::user();

        activity()
            ->causedBy($causer)
            ->event('role_deleted')
            ->withProperties([
                'role_name' => $role->name,
                'role_id' => $role->id,
                'had_permissions' => $role->permissions->pluck('name')->toArray(),
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Role '{$role->name}' deleted");
    }

    /**
     * Handle AdminOverrideUsed event
     */
    public function handleAdminOverride(\App\Events\AdminOverrideUsed $event): void
    {
        $activityLog = activity()
            ->causedBy($event->user)
            ->event('admin_override_used')
            ->withProperties([
                'override_reason' => $event->overrideReason,
                'override_type' => $event->overrideType,
                'context' => $event->context,
                'user_email' => $event->user->email,
                'user_name' => $event->user->name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

        if ($event->appointment) {
            $activityLog->performedOn($event->appointment);
            $activityLog->withProperties([
                'appointment_id' => $event->appointment->id,
                'appointment_datetime' => $event->appointment->appointment_datetime,
                'patient_id' => $event->appointment->patient_id,
            ]);
        }

        $activityLog->log("Admin override used: {$event->overrideReason} (Type: {$event->overrideType})");
    }
}
