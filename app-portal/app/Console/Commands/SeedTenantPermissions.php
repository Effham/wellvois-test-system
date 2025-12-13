<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Database\Seeders\RolesAndPermissionSeederNewTenant;
use Illuminate\Console\Command;

class SeedTenantPermissions extends Command
{
    protected $signature = 'tenants:seed-permissions {tenant?}';

    protected $description = 'Seed permissions for tenant(s)';

    public function handle()
    {
        $tenantId = $this->argument('tenant');

        if ($tenantId) {
            $tenants = [Tenant::findOrFail($tenantId)];
        } else {
            $tenants = Tenant::all();
        }

        foreach ($tenants as $tenant) {
            $this->info('Seeding permissions for tenant: '.$tenant->id);

            tenancy()->initialize($tenant);

            try {
                $seeder = new RolesAndPermissionSeederNewTenant;
                $seeder->run();
                $this->info('✅ Successfully seeded permissions for tenant: '.$tenant->id);
            } catch (\Exception $e) {
                $this->error('❌ Failed to seed permissions for tenant: '.$tenant->id.' - Error: '.$e->getMessage());
            }

            tenancy()->end();
        }

        return 0;
    }
}
