<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;

class ListTenants extends Command
{
    protected $signature = 'tenants:list';

    protected $description = 'List all tenants';

    public function handle()
    {
        $tenants = Tenant::all(['id']);

        $this->info('Total tenants: '.$tenants->count());
        $this->info('Tenants:');

        foreach ($tenants as $tenant) {
            $this->line('- ID: '.$tenant->id);
        }

        return 0;
    }
}
