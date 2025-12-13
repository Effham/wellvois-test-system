<?php

namespace App\Console\Commands;

use App\Models\Practitioner;
use App\Models\Tenant;
use Illuminate\Console\Command;

class RegeneratePractitionerBlindIndexes extends Command
{
    protected $signature = 'practitioners:regenerate-blind-indexes {--tenant=}';

    protected $description = 'Regenerate blind indexes for tenant practitioners';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');

        if ($tenantId) {
            $tenants = Tenant::where('id', $tenantId)->get();
        } else {
            $tenants = Tenant::all();
        }

        foreach ($tenants as $tenant) {
            $this->info("Processing tenant: {$tenant->id}");

            tenancy()->initialize($tenant);

            try {
                $practitioners = Practitioner::all();
                $this->info("Found {$practitioners->count()} practitioners");

                foreach ($practitioners as $practitioner) {
                    // Access encrypted fields to trigger blind index generation
                    $practitioner->first_name;
                    $practitioner->last_name;
                    $practitioner->email;
                    $practitioner->license_number;

                    // Save to regenerate blind indexes
                    $practitioner->saveQuietly();

                    $this->info("Regenerated indexes for practitioner ID: {$practitioner->id}");
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
