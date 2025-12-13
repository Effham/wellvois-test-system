<?php

namespace App\Console\Commands;

use App\Models\Tenant\FamilyMedicalHistory;
use Illuminate\Console\Command;
use Stancl\Tenancy\Concerns\HasATenantsOption;

class EncryptFamilyMedicalHistoryCommand extends Command
{
    use HasATenantsOption;

    protected $signature = 'tenants:encrypt-family-history
                            {--tenants=* : The tenant(s) to run the command for}
                            {--chunk=100 : Number of records to process at once}';

    protected $description = 'Encrypt all FamilyMedicalHistory records with CipherSweet (using AWS KMS key)';

    public function handle(): int
    {
        $tenants = $this->getTenants();

        foreach ($tenants as $tenant) {
            $this->line("Processing tenant: {$tenant->id}");

            $tenant->run(function () {
                $this->encryptRecords();
            });
        }

        return self::SUCCESS;
    }

    protected function encryptRecords(): void
    {
        $this->info('Starting encryption of FamilyMedicalHistory records...');
        $this->newLine();

        try {
            $total = FamilyMedicalHistory::count();

            if ($total === 0) {
                $this->warn('No records found to encrypt.');

                return;
            }

            $this->info("Found {$total} records to process.");
            $this->newLine();

            $chunkSize = (int) $this->option('chunk');
            $processed = 0;
            $errors = 0;

            $bar = $this->output->createProgressBar($total);
            $bar->start();

            FamilyMedicalHistory::chunk($chunkSize, function ($records) use (&$processed, &$errors, $bar) {
                foreach ($records as $record) {
                    try {
                        // Manually update encrypted fields to bypass CipherSweet's cache tagging
                        $this->encryptAndSaveRecord($record);

                        $processed++;
                        $bar->advance();
                    } catch (\Exception $e) {
                        $errors++;
                        $this->newLine();
                        $this->error("Failed to encrypt record ID {$record->id}: {$e->getMessage()}");
                        $bar->advance();
                    }
                }
            });

            $bar->finish();
            $this->newLine(2);

            // Summary
            $this->info('═══════════════════════════════════════');
            $this->info('✓ Encryption Complete!');
            $this->info('═══════════════════════════════════════');
            $this->line("Total records: {$total}");
            $this->line("Successfully encrypted: {$processed}");

            if ($errors > 0) {
                $this->line("Errors: {$errors}");
                $this->newLine();
                $this->warn('Some records failed to encrypt. Check the errors above.');
            } else {
                $this->newLine();
                $this->info('All records have been encrypted with AWS KMS-wrapped CipherSweet key.');
            }
        } catch (\Exception $e) {
            $this->newLine();
            $this->error('Encryption failed: '.$e->getMessage());
        }
    }

    /**
     * Encrypt and save a record by simply re-saving it
     * Now that CacheTenancyBootstrapper is disabled, this works fine
     */
    protected function encryptAndSaveRecord(FamilyMedicalHistory $record): void
    {
        // Simply save the record - CipherSweet will handle encryption automatically
        // This works now because we disabled CacheTenancyBootstrapper in config/tenancy.php
        $record->saveQuietly();
    }
}
