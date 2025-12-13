<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\WalletService;
use Illuminate\Console\Command;

class CreateClinicWallets extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'wallets:create-clinic';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create clinic wallets for all tenants that do not have one. Safe to run multiple times.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting clinic wallet creation for all tenants...');
        $this->newLine();

        $tenants = Tenant::all();
        $totalTenants = $tenants->count();

        if ($totalTenants === 0) {
            $this->warn('No tenants found in the system.');

            return self::SUCCESS;
        }

        $this->info("Found {$totalTenants} tenant(s). Processing...");
        $this->newLine();

        $created = 0;
        $alreadyExists = 0;
        $errors = 0;

        $progressBar = $this->output->createProgressBar($totalTenants);
        $progressBar->start();

        foreach ($tenants as $tenant) {
            try {
                // Initialize tenant context
                tenancy()->initialize($tenant);

                // Get WalletService
                $walletService = app(WalletService::class);

                // Get or create clinic wallet (will only create if doesn't exist)
                $wallet = $walletService->getSystemWallet();

                // Check if it was just created or already existed
                if ($wallet->wasRecentlyCreated) {
                    $created++;
                } else {
                    $alreadyExists++;
                }

                // End tenant context
                tenancy()->end();
            } catch (\Exception $e) {
                $errors++;
                $this->newLine();
                $this->error("Error processing tenant {$tenant->id}: {$e->getMessage()}");
                tenancy()->end(); // Make sure to end context even on error
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        // Display summary
        $this->info('=== Summary ===');
        $this->line("Total tenants processed: {$totalTenants}");
        $this->line("Clinic wallets created: <fg=green>{$created}</>");
        $this->line("Already had clinic wallet: <fg=yellow>{$alreadyExists}</>");

        if ($errors > 0) {
            $this->line("Errors encountered: <fg=red>{$errors}</>");
        }

        $this->newLine();

        if ($errors > 0) {
            $this->warn('Command completed with errors. Please review the error messages above.');

            return self::FAILURE;
        }

        $this->info('✓ Command completed successfully!');

        return self::SUCCESS;
    }
}
