<?php

namespace App\Services;

use Aws\Kms\KmsClient;
use Illuminate\Support\Facades\Cache;
use ParagonIE\CipherSweet\Backend\Key\SymmetricKey;
use ParagonIE\CipherSweet\Contract\KeyProviderInterface;
use ParagonIE\CipherSweet\KeyProvider\StringProvider;

class AwsKmsKeyProvider implements KeyProviderInterface
{
    protected KmsClient $kmsClient;

    protected string $encryptedKey;

    protected string $kmsKeyId;

    protected ?StringProvider $decryptedProvider = null;

    public function __construct()
    {
        // Initialize AWS KMS Client
        $this->kmsClient = new KmsClient([
            'region' => config('ciphersweet.kms.region'),
            'version' => config('ciphersweet.kms.version', 'latest'),
            // Credentials will be automatically loaded from:
            // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
            // 2. IAM role (if running on EC2/ECS/Lambda)
            // 3. ~/.aws/credentials file
        ]);

        // The base64-encoded encrypted CipherSweet key from .env
        $this->encryptedKey = config('ciphersweet.kms.encrypted_key');

        // The KMS Key ID (ARN or alias)
        $this->kmsKeyId = config('ciphersweet.kms.key_id');

        if (empty($this->encryptedKey)) {
            throw new \RuntimeException('CIPHERSWEET_KMS_ENCRYPTED_KEY is not set in environment');
        }

        if (empty($this->kmsKeyId)) {
            throw new \RuntimeException('CIPHERSWEET_KMS_KEY_ID is not set in environment');
        }
    }

    /**
     * Get the symmetric key by decrypting it with AWS KMS
     */
    public function getSymmetricKey(): SymmetricKey
    {
        // Cache the decrypted key for the request lifecycle to avoid multiple KMS calls
        if ($this->decryptedProvider === null) {
            $this->decryptedProvider = $this->decryptKey();
        }

        return $this->decryptedProvider->getSymmetricKey();
    }

    /**
     * Decrypt the CipherSweet key using AWS KMS
     */
    protected function decryptKey(): StringProvider
    {
        // Use cache to avoid excessive KMS API calls (cache for 5 minutes)
        // Store base64-encoded key to avoid binary data issues with database cache
        $cacheKey = 'ciphersweet_decrypted_key_'.md5($this->encryptedKey);

        $base64PlaintextKey = Cache::remember($cacheKey, now()->addMinutes(5), function () {
            try {
                // Decode the base64-encoded encrypted key
                $encryptedBlob = base64_decode($this->encryptedKey);

                // Decrypt using AWS KMS
                $result = $this->kmsClient->decrypt([
                    'CiphertextBlob' => $encryptedBlob,
                    'KeyId' => $this->kmsKeyId,
                    // Add encryption context for additional security (optional but recommended)
                    'EncryptionContext' => [
                        'Application' => config('app.name'),
                        'Purpose' => 'CipherSweet-Encryption',
                    ],
                ]);

                // Get the plaintext key and base64-encode it for safe cache storage
                $plaintextKey = (string) $result['Plaintext'];

                // Return base64-encoded key to avoid binary data issues with database cache
                return base64_encode($plaintextKey);
            } catch (\Aws\Exception\AwsException $e) {
                // Log the error and throw a more user-friendly exception
                logger()->error('Failed to decrypt CipherSweet key with AWS KMS', [
                    'error' => $e->getMessage(),
                    'code' => $e->getAwsErrorCode(),
                ]);

                throw new \RuntimeException(
                    'Failed to decrypt CipherSweet key with AWS KMS: '.$e->getAwsErrorMessage()
                );
            }
        });

        // Decode the base64 key back to binary
        $plaintextKey = base64_decode($base64PlaintextKey);

        // Return a StringProvider with the decrypted key
        return new StringProvider($plaintextKey);
    }

    /**
     * Encrypt a plaintext CipherSweet key using AWS KMS
     * This is a helper method for initial key wrapping
     */
    public static function encryptKey(string $plaintextKey, string $kmsKeyId, string $region): string
    {
        $kmsClient = new KmsClient([
            'region' => $region,
            'version' => 'latest',
        ]);

        try {
            $result = $kmsClient->encrypt([
                'KeyId' => $kmsKeyId,
                'Plaintext' => $plaintextKey,
                // Add encryption context for additional security
                'EncryptionContext' => [
                    'Application' => config('app.name'),
                    'Purpose' => 'CipherSweet-Encryption',
                ],
            ]);

            // Return base64-encoded encrypted key
            return base64_encode((string) $result['CiphertextBlob']);
        } catch (\Aws\Exception\AwsException $e) {
            throw new \RuntimeException(
                'Failed to encrypt CipherSweet key with AWS KMS: '.$e->getAwsErrorMessage()
            );
        }
    }
}
