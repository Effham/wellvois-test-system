<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;

class ListPermissionsTenant extends Command
{
    protected $signature = 'permissions:list-tenant {tenant?}';

    protected $description = 'List all permissions in tenant context';

    public function handle()
    {
        $tenantId = $this->argument('tenant');

        if ($tenantId) {
            $tenant = \App\Models\Tenant::find($tenantId);
            if (! $tenant) {
                $this->error('Tenant not found');

                return 1;
            }
            tenancy()->initialize($tenant);
        }

        $this->info('Current tenant: '.(tenant('id') ?? 'Central'));

        $permissions = Permission::all()->pluck('name')->sort();

        $this->info('Total permissions: '.$permissions->count());
        $this->info('Permissions in current context:');

        foreach ($permissions as $permission) {
            $this->line('- '.$permission);
        }

        return 0;
    }
}
