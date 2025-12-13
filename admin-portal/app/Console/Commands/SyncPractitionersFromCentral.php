<?php

namespace App\Console\Commands;

use App\Models\CentralPractitioner;
use App\Models\Practitioner as TenantPractitioner;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncPractitionersFromCentral extends Command
{
    protected $signature = 'practitioners:sync-from-central {--tenant=} {--clear}';

    protected $description = 'Sync practitioners from central database to tenant';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $shouldClear = $this->option('clear');

        if ($tenantId) {
            $tenants = Tenant::where('id', $tenantId)->get();
        } else {
            $tenants = Tenant::all();
        }

        foreach ($tenants as $tenant) {
            $this->info("Processing tenant: {$tenant->id}");

            tenancy()->initialize($tenant);

            try {
                // Clear existing practitioners if requested
                if ($shouldClear) {
                    $count = TenantPractitioner::count();
                    TenantPractitioner::query()->delete();
                    $this->info("Cleared {$count} existing practitioners");
                }

                // Get practitioners from central database that are linked to this tenant
                // We need to use a model with CentralConnection to properly decrypt data
                $centralPractitioners = tenancy()->central(function () use ($tenant) {
                    $practitionerIds = DB::table('tenant_practitioners')
                        ->where('tenant_id', $tenant->id)
                        ->pluck('practitioner_id')
                        ->toArray();

                    if (empty($practitionerIds)) {
                        return collect([]);
                    }

                    // Query using the CentralPractitioner model to get decrypted data
                    return CentralPractitioner::whereIn('id', $practitionerIds)->get();
                });

                $this->info("Found {$centralPractitioners->count()} practitioners to sync");

                foreach ($centralPractitioners as $centralPractitioner) {
                    TenantPractitioner::syncFromCentral($centralPractitioner);
                    $this->info("Synced practitioner ID: {$centralPractitioner->id}");
                }

                $this->info("✓ Completed tenant: {$tenant->id}\n");
            } catch (\Exception $e) {
                $this->error("✗ Error for tenant {$tenant->id}: {$e->getMessage()}\n");
            }

            tenancy()->end();
        }

        $this->info('All done!');

        return 0;
    }
}
