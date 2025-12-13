<?php

namespace App\Console\Commands;

use App\Models\Tenant\Encounter;
use App\Models\Tenant\EncounterPrescription;
use App\Models\Tenant\FamilyMedicalHistory;
use App\Models\Tenant\KnownAllergy;
use App\Models\Tenant\Note;
use App\Models\Tenant\PatientMedicalHistory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Stancl\Tenancy\Concerns\HasATenantsOption;

class EncryptMedicalRecordsCommandV1 extends Command
{
    use HasATenantsOption;

    protected $signature = 'tenants:encrypt-medical-records-v1
                            {--tenants=* : The tenant(s) to run the command for}
                            {--key= : CipherSweet wrapped key (AWS KMS or base64)}
                            {--models=* : Specific models to encrypt (optional)}';

    protected $description = 'Encrypt all medical records (Layer 1) for each tenant using CipherSweet package command';

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
        $key = $this->option('key') ?? env('CIPHERSWEET_KEY');

        if (! $key) {
            $this->error('❌ No CipherSweet key provided. Use --key or set CIPHERSWEET_KEY in .env');

            return self::FAILURE;
        }

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
        $this->info('  Medical Records Encryption (Layer 1 - V1)');
        $this->info('═══════════════════════════════════════════════');
        $this->line("Tenants: {$tenants->count()}");
        $this->line('Models: '.implode(', ', array_keys($modelsToEncrypt)));
        $this->newLine();

        foreach ($tenants as $tenant) {
            $this->info("▶ Processing tenant: {$tenant->id}");
            $this->newLine();

            $tenant->run(function () use ($key, $modelsToEncrypt) {
                foreach ($modelsToEncrypt as $modelName => $modelClass) {
                    try {
                        $this->line("  ├─ Encrypting {$modelName}...");

                        // Call package's ciphersweet:encrypt command
                        $model = addslashes($modelClass);
                        Artisan::call("ciphersweet:encrypt \"{$model}\" \"{$key}\"");

                        $output = trim(Artisan::output());
                        if ($output) {
                            $this->line("  │  {$output}");
                        }

                        $this->info("  └─ ✓ {$modelName} encrypted successfully");
                        $this->newLine();
                    } catch (\Exception $e) {
                        $this->error("  └─ ❌ {$modelName} failed: {$e->getMessage()}");
                        $this->newLine();
                    }
                }
            });
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('🎉 Layer 1 encryption completed for all tenants');
        $this->info('═══════════════════════════════════════════════');
        $this->line('Next step: Run tenants:encrypt-medical-records for Layer 2');
        $this->newLine();

        return self::SUCCESS;
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
