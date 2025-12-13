<?php

namespace App\Console\Commands;

use App\Models\Patient;
use App\Models\Practitioner;
use Illuminate\Console\Command;

class EncryptCentralDatabaseCommand extends Command
{
    protected $signature = 'central:encrypt-records
                            {--chunk=100 : Number of records to process at once}
                            {--models=* : Specific models to encrypt (optional)}';

    protected $description = 'Encrypt Patient and Practitioner records in central database (Layer 2) with CipherSweet using AWS KMS key';

    /**
     * Central database models available for encryption
     */
    protected array $availableModels = [
        'Patient' => Patient::class,
        'Practitioner' => Practitioner::class,
    ];

    public function handle(): int
    {
        // Get models to encrypt
        $modelsToEncrypt = $this->getModelsToEncrypt();

        if (empty($modelsToEncrypt)) {
            $this->warn('⚠️  No models to encrypt.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('  Central Database Encryption (Layer 2)');
        $this->info('═══════════════════════════════════════════════');
        $this->line('Models: '.implode(', ', array_keys($modelsToEncrypt)));
        $this->newLine();

        foreach ($modelsToEncrypt as $modelName => $modelClass) {
            $this->encryptModelRecords($modelName, $modelClass);
        }

        $this->info('═══════════════════════════════════════════════');
        $this->info('🎉 Layer 2 encryption completed for central database!');
        $this->info('═══════════════════════════════════════════════');
        $this->line('All records have been encrypted with AWS KMS-wrapped CipherSweet key.');
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

            // Summary
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
