<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\Tenant\Consent;
use Illuminate\Console\Command;

class UpdatePractitionerConsents extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'consent:update-practitioner-required';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update all practitioner consents to is_required = true across all tenants';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Updating all practitioner consents to is_required = true...');

        // Get all tenants
        $tenants = Tenant::all();

        if ($tenants->isEmpty()) {
            $this->warn('No tenants found.');

            return Command::SUCCESS;
        }

        $this->info("Found {$tenants->count()} tenants to process.");

        $totalUpdated = 0;

        foreach ($tenants as $tenant) {
            try {
                $this->info("Processing tenant: {$tenant->company_name} (ID: {$tenant->id})");

                // Initialize tenancy
                tenancy()->initialize($tenant);

                // Update all PRACTITIONER consents to is_required = true
                $updated = Consent::where('entity_type', 'PRACTITIONER')
                    ->where('is_required', 0)
                    ->update(['is_required' => 1]);

                if ($updated > 0) {
                    $this->info("✓ Updated {$updated} practitioner consent(s) for {$tenant->company_name}");
                    $totalUpdated += $updated;
                } else {
                    $this->comment("  No practitioner consents needed updating for {$tenant->company_name}");
                }

                // End tenancy
                tenancy()->end();

            } catch (\Exception $e) {
                $this->error("✗ Failed to process {$tenant->company_name}: ".$e->getMessage());

                try {
                    tenancy()->end();
                } catch (\Exception $endException) {
                    $this->warn("Warning: Could not end tenancy for {$tenant->company_name}");
                }
            }
        }

        $this->newLine();
        $this->info('Update completed!');
        $this->info("Total practitioner consents updated: {$totalUpdated}");

        return Command::SUCCESS;
    }
}
