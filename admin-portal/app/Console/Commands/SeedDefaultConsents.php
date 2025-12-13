<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Database\Seeders\DefaultConsentSeeder;
use Illuminate\Console\Command;
use Stancl\Tenancy\Facades\Tenancy;

class SeedDefaultConsents extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'consent:seed-defaults';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Seed default consents for all tenants';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting to seed default consents for all tenants...');

        // Get all tenants
        $tenants = Tenant::all();

        if ($tenants->isEmpty()) {
            $this->warn('No tenants found.');

            return;
        }

        $this->info("Found {$tenants->count()} tenants to process.");

        $successCount = 0;
        $errorCount = 0;

        foreach ($tenants as $tenant) {
            try {
                $this->info("Processing tenant: {$tenant->company_name} (ID: {$tenant->id})");

                // Initialize tenancy for this tenant
                tenancy()->initialize($tenant);

                // Run the seeder
                $seeder = new DefaultConsentSeeder;
                $seeder->setCommand($this);
                $seeder->run();

                // End tenancy
                tenancy()->end();

                $successCount++;
                $this->info("✓ Successfully seeded consents for {$tenant->company_name}");

            } catch (\Exception $e) {
                $errorCount++;
                $this->error("✗ Failed to seed consents for {$tenant->company_name}: ".$e->getMessage());

                // Make sure to end tenancy even if there's an error
                try {
                    tenancy()->end();
                } catch (\Exception $endException) {
                    $this->warn("Warning: Could not end tenancy for {$tenant->company_name}");
                }
            }
        }

        $this->newLine();
        $this->info('Seeding completed!');
        $this->info("Successfully processed: {$successCount} tenants");

        if ($errorCount > 0) {
            $this->warn("Failed to process: {$errorCount} tenants");
        }

        return Command::SUCCESS;
    }
}
