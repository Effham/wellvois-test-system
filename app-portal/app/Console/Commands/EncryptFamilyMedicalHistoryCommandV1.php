<?php

namespace App\Console\Commands;

use App\Models\Tenant\FamilyMedicalHistory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Stancl\Tenancy\Concerns\HasATenantsOption;

class EncryptFamilyMedicalHistoryCommandv1 extends Command
{
    use HasATenantsOption;

    protected $signature = 'tenants:encrypt-family-history-v1
                            {--tenants=* : The tenant(s) to run the command for)}
                            {--key= : CipherSweet wrapped key (AWS KMS or base64)}';

    protected $description = 'Encrypt all FamilyMedicalHistory records for each tenant using CipherSweet and AWS KMS key';

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

        foreach ($tenants as $tenant) {
            $this->newLine();
            $this->info('═══════════════════════════════════════════════');
            $this->info("▶ Processing tenant: {$tenant->id}");
            $this->info('═══════════════════════════════════════════════');
            $tenant->run(function () use ($key, $tenant) {
                try {
                    // ✅ Works for older CipherSweet versions
                    $model = addslashes(FamilyMedicalHistory::class);
                    Artisan::call("ciphersweet:encrypt \"{$model}\" \"{$key}\"");

                    $output = trim(Artisan::output());
                    $this->line($output ?: '✅ Encryption completed successfully.');
                } catch (\Exception $e) {
                    $this->error("❌ Tenant {$tenant->id} failed: {$e->getMessage()}");
                }
            });
        }

        $this->newLine();
        $this->info('🎉 All tenant FamilyMedicalHistory records processed.');

        return self::SUCCESS;
    }
}
