<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;

class ListPermissions extends Command
{
    protected $signature = 'permissions:list';

    protected $description = 'List all permissions in the database';

    public function handle()
    {
        $permissions = Permission::all()->pluck('name')->sort();

        $this->info('Total permissions: '.$permissions->count());
        $this->info('Permissions in database:');

        foreach ($permissions as $permission) {
            $this->line('- '.$permission);
        }

        return 0;
    }
}
