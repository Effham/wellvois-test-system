<?php

namespace App\Console\Commands;

use App\Services\AwsKmsKeyProvider;
use Illuminate\Console\Command;

class WrapCipherSweetKeyCommand extends Command
{
    protected $signature = 'ciphersweet:wrap-key
                            {--plaintext-key= : The plaintext CipherSweet key to wrap}
                            {--kms-key-id= : The AWS KMS Key ID or ARN}
                            {--region= : The AWS region}';

    protected $description = 'Wrap (encrypt) a CipherSweet key using AWS KMS';

    public function handle(): int
    {
        // Get parameters
        $plaintextKey = $this->option('plaintext-key') ?? config('ciphersweet.providers.string.key');
        $kmsKeyId = $this->option('kms-key-id') ?? config('ciphersweet.kms.key_id');
        $region = $this->option('region') ?? config('ciphersweet.kms.region');

        // Validate inputs
        if (empty($plaintextKey)) {
            $this->error('No plaintext key provided. Either pass --plaintext-key or set CIPHERSWEET_KEY in .env');

            return self::FAILURE;
        }

        if (empty($kmsKeyId)) {
            $this->error('No KMS Key ID provided. Either pass --kms-key-id or set CIPHERSWEET_KMS_KEY_ID in .env');

            return self::FAILURE;
        }

        if (empty($region)) {
            $this->error('No AWS region provided. Either pass --region or set CIPHERSWEET_KMS_REGION in .env');

            return self::FAILURE;
        }

        $this->info('Wrapping CipherSweet key with AWS KMS...');
        $this->info("KMS Key ID: {$kmsKeyId}");
        $this->info("Region: {$region}");

        try {
            $encryptedKey = AwsKmsKeyProvider::encryptKey($plaintextKey, $kmsKeyId, $region);

            $this->newLine();
            $this->info('✓ Successfully wrapped CipherSweet key!');
            $this->newLine();
            $this->line('Add this to your .env file:');
            $this->newLine();
            $this->line("CIPHERSWEET_KMS_ENCRYPTED_KEY=\"{$encryptedKey}\"");
            $this->newLine();
            $this->warn('Important: After adding the encrypted key to .env:');
            $this->warn('1. Change CIPHERSWEET_PROVIDER from "string" to "custom"');
            $this->warn('2. Remove or comment out the old CIPHERSWEET_KEY variable');
            $this->warn('3. Make sure CIPHERSWEET_KMS_KEY_ID and CIPHERSWEET_KMS_REGION are set');
            $this->newLine();

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to wrap CipherSweet key: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
