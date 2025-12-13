<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use ParagonIE\CipherSweet\Contract\KeyProviderInterface;

class TestKmsIntegrationCommand extends Command
{
    protected $signature = 'ciphersweet:test-kms';

    protected $description = 'Test AWS KMS integration with CipherSweet';

    public function handle(): int
    {
        $this->info('Testing AWS KMS CipherSweet Integration...');
        $this->newLine();

        // Test 1: Check configuration
        $this->info('1. Checking configuration...');
        $provider = config('ciphersweet.provider');
        $this->line("   Provider: {$provider}");

        if ($provider !== 'custom') {
            $this->warn('   ⚠ Provider is not set to "custom". KMS is not enabled.');
            $this->line('   Set CIPHERSWEET_PROVIDER=custom in .env to use KMS');

            return self::FAILURE;
        }

        $region = config('ciphersweet.kms.region');
        $keyId = config('ciphersweet.kms.key_id');
        $encryptedKey = config('ciphersweet.kms.encrypted_key');

        $this->line("   Region: {$region}");
        $this->line("   Key ID: {$keyId}");
        $this->line('   Encrypted Key: '.(strlen($encryptedKey) > 0 ? '✓ Set' : '✗ Not Set'));

        if (empty($encryptedKey)) {
            $this->error('   ✗ CIPHERSWEET_KMS_ENCRYPTED_KEY is not set');
            $this->line('   Run: php artisan ciphersweet:wrap-key');

            return self::FAILURE;
        }

        $this->info('   ✓ Configuration looks good');
        $this->newLine();

        // Test 2: Try to decrypt key from KMS
        $this->info('2. Testing KMS key decryption...');

        try {
            $keyProvider = app(KeyProviderInterface::class);
            $symmetricKey = $keyProvider->getSymmetricKey();

            $this->info('   ✓ Successfully decrypted key from AWS KMS');
            $this->newLine();
        } catch (\Exception $e) {
            $this->error('   ✗ Failed to decrypt key from AWS KMS');
            $this->line('   Error: '.$e->getMessage());
            $this->newLine();
            $this->warn('Troubleshooting:');
            $this->line('   - Check IAM permissions (kms:Decrypt)');
            $this->line('   - Verify CIPHERSWEET_KMS_KEY_ID is correct');
            $this->line('   - Verify CIPHERSWEET_KMS_REGION matches key location');
            $this->line('   - Check AWS credentials are valid');

            return self::FAILURE;
        }

        // Test 3: Test encryption/decryption
        $this->info('3. Testing CipherSweet encryption/decryption...');

        try {
            // Use CipherSweet to encrypt a test value
            $backend = app(\ParagonIE\CipherSweet\CipherSweet::class)->getBackend();
            $testPlaintext = 'Test Patient Data';
            $encrypted = $backend->encrypt($testPlaintext, $symmetricKey);
            $decrypted = $backend->decrypt($encrypted, $symmetricKey);

            if ($decrypted === $testPlaintext) {
                $this->info('   ✓ Encryption/decryption working correctly');
            } else {
                $this->error('   ✗ Decrypted value does not match original');

                return self::FAILURE;
            }

            $this->newLine();
        } catch (\Exception $e) {
            $this->error('   ✗ Encryption/decryption failed');
            $this->line('   Error: '.$e->getMessage());

            return self::FAILURE;
        }

        // Test 4: Check cache (optional)
        $this->info('4. Testing cache...');
        $cacheDriver = config('cache.default');
        $this->line("   Cache driver: {$cacheDriver}");

        if (in_array($cacheDriver, ['redis', 'memcached'])) {
            $this->info('   ✓ Using fast cache driver');
        } else {
            $this->warn('   ⚠ Consider using Redis or Memcached for better performance');
        }

        $this->newLine();

        // Summary
        $this->info('═══════════════════════════════════════');
        $this->info('✓ All tests passed!');
        $this->info('═══════════════════════════════════════');
        $this->line('AWS KMS integration is working correctly.');
        $this->line('Your CipherSweet key is being decrypted from KMS.');
        $this->newLine();

        return self::SUCCESS;
    }
}
