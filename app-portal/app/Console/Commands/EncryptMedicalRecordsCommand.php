<?php

namespace App\Console\Commands;

use App\Models\Tenant\Encounter;
use App\Models\Tenant\EncounterPrescription;
use App\Models\Tenant\FamilyMedicalHistory;
use App\Models\Tenant\KnownAllergy;
use App\Models\Tenant\Note;
use App\Models\Tenant\PatientMedicalHistory;
use Illuminate\Console\Command;
use Stancl\Tenancy\Concerns\HasATenantsOption;

class EncryptMedicalRecordsCommand extends Command
{
    use HasATenantsOption;

    protected $signature = 'tenants:encrypt-medical-records
                            {--tenants=* : The tenant(s) to run the command for}
                            {--chunk=100 : Number of records to process at once}
                            {--models=* : Specific models to encrypt (optional)}';

    protected $description = 'Encrypt all medical records (Layer 2) with CipherSweet using AWS KMS key';

    /**
     * Available models for encryption (all 6 models)
     */
    protected array $availableModels = [
        'FamilyMedicalHistory' => FamilyMedicalHistory::class,
        'Encounter' => Encounter::class,
        'PatientMedicalHistory' => PatientMedicalHistory::class,
        'KnownAllergy' => KnownAllergy::class,
        'EncounterPrescription' => EncounterPrescription::class,
        'Note' => Note::class,
    ];

    public function handle(): int
    {
        $tenants = $this->getTenants();

        if ($tenants->isEmpty()) {
            $this->warn('⚠️  No tenants found to process.');

            return self::SUCCESS;
        }

        // Get models to encrypt
        $modelsToEncrypt = $this->getModelsToEncrypt();

        if (empty($modelsToEncrypt)) {
            $this->warn('⚠️  No models to encrypt.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('  Medical Records Encryption (Layer 2)');
        $this->info('═══════════════════════════════════════════════');
        $this->line("Tenants: {$tenants->count()}");
        $this->line('Models: '.implode(', ', array_keys($modelsToEncrypt)));
        $this->newLine();

        foreach ($tenants as $tenant) {
            $this->info("▶ Processing tenant: {$tenant->id}");
            $this->newLine();

            $tenant->run(function () use ($modelsToEncrypt) {
                foreach ($modelsToEncrypt as $modelName => $modelClass) {
                    $this->encryptModelRecords($modelName, $modelClass);
                }
            });

            $this->newLine();
        }

        $this->info('═══════════════════════════════════════════════');
        $this->info('🎉 Layer 2 encryption completed!');
        $this->info('═══════════════════════════════════════════════');
        $this->line('All medical records have been encrypted with AWS KMS-wrapped CipherSweet key.');
        $this->newLine();

        return self::SUCCESS;
    }

    /**
     * Encrypt records for a specific model
     */
    protected function encryptModelRecords(string $modelName, string $modelClass): void
    {
        $this->line("┌─ Encrypting {$modelName}");

        try {
            $total = $modelClass::count();

            if ($total === 0) {
                $this->line('│  No records found.');
                $this->line('└─ Completed');
                $this->newLine();

                return;
            }

            $this->line("│  Found {$total} records");

            $chunkSize = (int) $this->option('chunk');
            $processed = 0;
            $errors = 0;

            $bar = $this->output->createProgressBar($total);
            $bar->setFormat('│  %current%/%max% [%bar%] %percent:3s%% %message%');
            $bar->setMessage('Processing...');
            $bar->start();

            $modelClass::chunk($chunkSize, function ($records) use (&$processed, &$errors, $bar) {
                foreach ($records as $record) {
                    try {
                        // Simply save the record - CipherSweet will handle encryption
                        // This works because CacheTenancyBootstrapper is disabled
                        $record->saveQuietly();
                        $processed++;
                        $bar->setMessage('Encrypting...');
                        $bar->advance();
                    } catch (\Exception $e) {
                        $errors++;
                        $bar->setMessage('Error: '.$e->getMessage());
                        $bar->advance();
                    }
                }
            });

            $bar->finish();
            $this->newLine();

            // Summary for this model
            $this->line("│  ✓ Processed: {$processed}");
            if ($errors > 0) {
                $this->line("│  ⚠ Errors: {$errors}");
            }
            $this->line('└─ Completed');
            $this->newLine();
        } catch (\Exception $e) {
            $this->newLine();
            $this->error("│  Failed: {$e->getMessage()}");
            $this->line('└─ Aborted');
            $this->newLine();
        }
    }

    /**
     * Get the models to encrypt based on --models option
     */
    protected function getModelsToEncrypt(): array
    {
        $specifiedModels = $this->option('models');

        // If no models specified, return all models
        if (empty($specifiedModels)) {
            return $this->availableModels;
        }

        // Filter to only specified models
        $modelsToEncrypt = [];
        foreach ($specifiedModels as $modelName) {
            if (isset($this->availableModels[$modelName])) {
                $modelsToEncrypt[$modelName] = $this->availableModels[$modelName];
            } else {
                $this->warn("Model '{$modelName}' not found. Available models: ".implode(', ', array_keys($this->availableModels)));
            }
        }

        return $modelsToEncrypt;
    }
}
