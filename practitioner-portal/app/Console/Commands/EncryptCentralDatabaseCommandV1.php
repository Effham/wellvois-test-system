<?php

namespace App\Console\Commands;

use App\Models\Patient;
use App\Models\Practitioner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class EncryptCentralDatabaseCommandV1 extends Command
{
    protected $signature = 'central:encrypt-records-v1
                            {--key= : CipherSweet wrapped key (AWS KMS or base64)}
                            {--models=* : Specific models to encrypt (optional)}';

    protected $description = 'Encrypt Patient and Practitioner records in central database (Layer 1) using CipherSweet package command';

    /**
     * Central database models available for encryption
     */
    protected array $availableModels = [
        'Patient' => Patient::class,
        'Practitioner' => Practitioner::class,
    ];

    public function handle(): int
    {
        $key = $this->option('key') ?? env('CIPHERSWEET_KEY');

        if (! $key) {
            $this->error('❌ No CipherSweet key provided. Use --key or set CIPHERSWEET_KEY in .env');

            return self::FAILURE;
        }

        // Get models to encrypt
        $modelsToEncrypt = $this->getModelsToEncrypt();

        if (empty($modelsToEncrypt)) {
            $this->warn('⚠️  No models to encrypt.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('  Central Database Encryption (Layer 1 - V1)');
        $this->info('═══════════════════════════════════════════════');
        $this->line('Models: '.implode(', ', array_keys($modelsToEncrypt)));
        $this->newLine();

        foreach ($modelsToEncrypt as $modelName => $modelClass) {
            try {
                $this->line("  ├─ Encrypting {$modelName} records...");

                // Call package's ciphersweet:encrypt command
                $model = addslashes($modelClass);
                Artisan::call("ciphersweet:encrypt \"{$model}\" \"{$key}\"");

                $output = trim(Artisan::output());
                if ($output) {
                    $this->line("  │  {$output}");
                }

                $this->info("  └─ ✓ {$modelName} records encrypted successfully");
                $this->newLine();
            } catch (\Exception $e) {
                $this->error("  └─ ❌ {$modelName} encryption failed: {$e->getMessage()}");
                $this->newLine();

                return self::FAILURE;
            }
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('🎉 Layer 1 encryption completed for central database');
        $this->info('═══════════════════════════════════════════════');
        $this->line('Next step: Run central:encrypt-records for Layer 2');
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
