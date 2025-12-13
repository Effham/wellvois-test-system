<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class VerifyRoleAssignments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'roles:verify {--tenant= : Specific tenant ID to check}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verify role and permission assignments for users';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $tenantId = $this->option('tenant');

        if ($tenantId) {
            $this->info("Checking roles for tenant: {$tenantId}");
            // Switch to tenant context if provided
            tenancy()->initialize($tenantId);
        } else {
            $this->info('Checking roles in current context');
        }

        try {
            $this->info('=== ROLE VERIFICATION REPORT ===');
            $this->info('Current Tenant: '.(tenant() ? tenant('id') : 'None (Central Database)'));
            $this->newLine();

            // Check if roles exist
            $this->checkRolesExist();
            $this->newLine();

            // Check if permissions exist
            $this->checkPermissionsExist();
            $this->newLine();

            // Check user role assignments
            $this->checkUserRoleAssignments();
            $this->newLine();

            // Check for users without roles
            $this->checkUsersWithoutRoles();

        } catch (\Exception $e) {
            $this->error('Error during verification: '.$e->getMessage());
            $this->error('Stack trace: '.$e->getTraceAsString());
        }
    }

    private function checkRolesExist()
    {
        $this->info('🔍 Checking if roles exist...');

        $expectedRoles = ['Admin', 'Practitioner', 'Patient'];
        $existingRoles = Role::whereIn('name', $expectedRoles)->pluck('name')->toArray();

        foreach ($expectedRoles as $roleName) {
            if (in_array($roleName, $existingRoles)) {
                $role = Role::where('name', $roleName)->first();
                $permissionCount = $role->permissions()->count();
                $this->info("  ✅ {$roleName} role exists (ID: {$role->id}) with {$permissionCount} permissions");
            } else {
                $this->error("  ❌ {$roleName} role does NOT exist");
            }
        }
    }

    private function checkPermissionsExist()
    {
        $this->info('🔍 Checking permissions...');

        $expectedPermissions = [
            'view-users', 'add-users', 'update-users', 'delete-users',
            'view-roles', 'add-roles', 'update-roles', 'delete-roles',
            'view-activity-logs',
            'view-patient', 'add-patient', 'update-patient', 'delete-patient',
            'view-practitioner', 'add-practitioner', 'update-practitioner', 'delete-practitioner',
            'view-services', 'add-services', 'update-services', 'delete-services',
            'view-practitioner-personal-calendar',
            'view-settings',
        ];

        $existingPermissions = Permission::whereIn('name', $expectedPermissions)->pluck('name')->toArray();
        $missingPermissions = array_diff($expectedPermissions, $existingPermissions);

        $this->info('  ✅ Found '.count($existingPermissions).' of '.count($expectedPermissions).' expected permissions');

        if (! empty($missingPermissions)) {
            $this->warn('  ⚠️  Missing permissions: '.implode(', ', $missingPermissions));
        }
    }

    private function checkUserRoleAssignments()
    {
        $this->info('🔍 Checking user role assignments...');

        $users = User::with('roles')->get();

        if ($users->isEmpty()) {
            $this->warn('  ⚠️  No users found in database');

            return;
        }

        $this->info("  Found {$users->count()} users:");

        foreach ($users as $user) {
            $roles = $user->getRoleNames()->toArray();
            $roleDisplay = empty($roles) ? 'NO ROLES' : implode(', ', $roles);

            if (empty($roles)) {
                $this->error("    ❌ {$user->name} ({$user->email}) - {$roleDisplay}");
            } else {
                $this->info("    ✅ {$user->name} ({$user->email}) - {$roleDisplay}");
            }
        }
    }

    private function checkUsersWithoutRoles()
    {
        $this->info('🔍 Checking for users without roles...');

        $usersWithoutRoles = User::doesntHave('roles')->get();

        if ($usersWithoutRoles->isEmpty()) {
            $this->info('  ✅ All users have roles assigned');
        } else {
            $this->warn("  ⚠️  Found {$usersWithoutRoles->count()} users without roles:");
            foreach ($usersWithoutRoles as $user) {
                $this->warn("    - {$user->name} ({$user->email})");
            }

            $this->newLine();
            if ($this->confirm('Would you like to assign Admin role to users without roles?')) {
                $this->assignAdminRoleToUsersWithoutRoles($usersWithoutRoles);
            }
        }
    }

    private function assignAdminRoleToUsersWithoutRoles($users)
    {
        $adminRole = Role::where('name', 'Admin')->first();

        if (! $adminRole) {
            $this->error('Admin role not found! Cannot assign roles.');

            return;
        }

        foreach ($users as $user) {
            try {
                $user->assignRole($adminRole);
                $this->info("  ✅ Assigned Admin role to {$user->name}");
            } catch (\Exception $e) {
                $this->error("  ❌ Failed to assign role to {$user->name}: ".$e->getMessage());
            }
        }

        $this->info('Role assignment completed!');
    }
}
