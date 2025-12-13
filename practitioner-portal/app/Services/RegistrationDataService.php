<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class RegistrationDataService
{
    /**
     * Encrypt registration data with expiration timestamp
     *
     * @param  array  $data  Registration data to encrypt
     * @return string Base64-encoded encrypted string
     */
    public static function encrypt(array $data): string
    {
        // Add expiration timestamp (2 hours from now)
        $payload = [
            'data' => $data,
            'expires_at' => Carbon::now()->addHours(2)->timestamp,
        ];

        // Encrypt the payload
        $encrypted = Crypt::encrypt($payload);

        // Base64 encode for URL safety
        return base64_encode($encrypted);
    }

    /**
     * Decrypt and validate registration data
     *
     * @param  string  $encrypted  Base64-encoded encrypted string
     * @return array|null Decrypted data or null if invalid/expired
     */
    public static function decrypt(string $encrypted): ?array
    {
        try {
            // Decode from base64
            $decoded = base64_decode($encrypted, true);

            if ($decoded === false) {
                Log::warning('Registration token: Invalid base64 encoding');

                return null;
            }

            // Decrypt the payload
            $payload = Crypt::decrypt($decoded);

            // Validate structure
            if (! is_array($payload) || ! isset($payload['data'], $payload['expires_at'])) {
                Log::warning('Registration token: Invalid payload structure');

                return null;
            }

            // Check expiration
            if (Carbon::createFromTimestamp($payload['expires_at'])->isPast()) {
                Log::warning('Registration token: Token expired', [
                    'expired_at' => Carbon::createFromTimestamp($payload['expires_at'])->toDateTimeString(),
                ]);

                return null;
            }

            return $payload['data'];
        } catch (\Exception $e) {
            Log::error('Registration token decryption failed', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Create registration token from validated data
     *
     * @param  array  $data  Validated registration data
     * @return string Encrypted token
     */
    public static function createRegistrationToken(array $data): string
    {
        // Ensure all required fields are present
        $requiredFields = [
            'tenant_id',
            'company_name',
            'domain',
            'admin_name',
            'admin_email',
            'admin_password', // Should already be hashed
            'plan_id',
        ];

        foreach ($requiredFields as $field) {
            if (! isset($data[$field])) {
                throw new \InvalidArgumentException("Missing required field: {$field}");
            }
        }

        return self::encrypt($data);
    }

    /**
     * Validate registration token and return data
     *
     * @param  string  $token  Encrypted token
     * @return array|null Registration data or null if invalid
     */
    public static function validateToken(string $token): ?array
    {
        $data = self::decrypt($token);

        if (! $data) {
            return null;
        }

        // Validate required fields exist
        $requiredFields = [
            'tenant_id',
            'company_name',
            'domain',
            'admin_name',
            'admin_email',
            'admin_password',
            'plan_id',
        ];

        foreach ($requiredFields as $field) {
            if (! isset($data[$field])) {
                Log::warning('Registration token: Missing required field', ['field' => $field]);

                return null;
            }
        }

        return $data;
    }
}
