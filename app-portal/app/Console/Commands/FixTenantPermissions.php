<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class FixTenantPermissions extends Command
{
    protected $signature = 'tenants:fix-permissions {tenant_id?}';

    protected $description = 'Fix role and permission setup for tenants that failed during creation';

    public function handle()
    {
        $tenantId = $this->argument('tenant_id');

        if ($tenantId) {
            return $this->fixTenant($tenantId);
        } else {
            $this->info('Scanning all tenants for permission issues...');

            foreach (Tenant::all() as $tenant) {
                $this->fixTenant($tenant->id);
            }
        }

        return 0;
    }

    private function fixTenant($tenantId)
    {
        $tenant = Tenant::find($tenantId);

        if (! $tenant) {
            $this->error("Tenant {$tenantId} not found");

            return 1;
        }

        $this->info("Checking tenant: {$tenant->id}");

        tenancy()->initialize($tenant);

        try {
            // Check if migrations have been run
            $tablesExist = \Schema::hasTable('users') && \Schema::hasTable('roles');

            if (! $tablesExist) {
                $this->warn('  Database tables missing, running migrations...');
                Artisan::call('tenants:migrate', [
                    '--tenants' => [$tenant->id],
                    '--force' => true,
                ]);
                $this->info('  ✓ Migrations completed');
            }

            // Check if roles exist
            $rolesExist = \Spatie\Permission\Models\Role::exists();

            if (! $rolesExist) {
                $this->warn('  No roles found, running seeder...');
                Artisan::call('db:seed', [
                    '--class' => 'RolesAndPermissionSeederNewTenant',
                    '--force' => true,
                ]);
                $this->info('  ✓ Roles and permissions seeded');
            } else {
                $roleCount = \Spatie\Permission\Models\Role::count();
                $this->info("  ✓ {$roleCount} roles exist");
            }

            // Check for users without roles
            $usersWithoutRoles = User::doesntHave('roles')->get();

            if ($usersWithoutRoles->count() > 0) {
                $this->warn("  Found {$usersWithoutRoles->count()} users without roles");

                $firstUser = User::orderBy('id', 'asc')->first();

                foreach ($usersWithoutRoles as $user) {
                    if ($firstUser && $user->id === $firstUser->id) {
                        $adminRole = \Spatie\Permission\Models\Role::where('name', 'Admin')->first();
                        if ($adminRole) {
                            $user->assignRole($adminRole);
                            $this->info("  ✓ Assigned Admin role to {$user->email}");
                        }
                    } else {
                        $this->line("  → User {$user->email} left without role (not first user)");
                    }
                }
            } else {
                $userCount = User::count();
                $this->info("  ✓ All {$userCount} users have roles");
            }

            // Verify first user has Admin role
            $firstUser = User::orderBy('id', 'asc')->first();
            if ($firstUser) {
                $hasAdmin = $firstUser->hasRole('Admin');
                $roles = $firstUser->getRoleNames()->toArray();

                if ($hasAdmin) {
                    $this->info("  ✓ First user ({$firstUser->email}) has Admin role");
                } else {
                    $this->warn('  ⚠ First user ('.$firstUser->email.') roles: '.implode(', ', $roles));
                }
            }

        } catch (\Exception $e) {
            $this->error('  ✗ Error: '.$e->getMessage());
            Log::error('FixTenantPermissions failed', [
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
            ]);
        } finally {
            tenancy()->end();
        }

        return 0;
    }
}
