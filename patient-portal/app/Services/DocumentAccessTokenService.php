<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class DocumentAccessTokenService
{
    /**
     * Token time-to-live in minutes (7 days).
     */
    public const TOKEN_TTL_MINUTES = 10080; // 7 days * 24 hours * 60 minutes

    /**
     * Generate a secure one-time access token for document access.
     */
    public function generateToken(int $patientId, int $encounterId, string $email, ?array $documentIds = null): string
    {
        // Generate a cryptographically secure random token
        $token = Str::random(64);

        // Store token data in cache with TTL
        $tokenData = [
            'patient_id' => $patientId,
            'encounter_id' => $encounterId,
            'email' => $email,
            'document_ids' => $documentIds,
            'created_at' => now()->toIso8601String(),
            'used' => false,
        ];

        // Use central cache context to avoid tenant tagging issues
        tenancy()->central(function () use ($token, $tokenData) {
            Cache::put(
                $this->getCacheKey($token),
                $tokenData,
                now()->addMinutes(self::TOKEN_TTL_MINUTES)
            );
        });

        return $token;
    }

    /**
     * Validate and retrieve token data.
     */
    public function validateToken(string $token): ?array
    {
        // Use central cache context to avoid tenant tagging issues
        $tokenData = tenancy()->central(function () use ($token) {
            return Cache::get($this->getCacheKey($token));
        });

        if (! $tokenData) {
            return null;
        }

        if ($tokenData['used'] ?? false) {
            return null;
        }

        return $tokenData;
    }

    /**
     * Mark token as used (single-use enforcement).
     */
    public function markTokenAsUsed(string $token): void
    {
        // Use central cache context to avoid tenant tagging issues
        tenancy()->central(function () use ($token) {
            $tokenData = Cache::get($this->getCacheKey($token));

            if ($tokenData) {
                $tokenData['used'] = true;
                Cache::put(
                    $this->getCacheKey($token),
                    $tokenData,
                    now()->addMinutes(self::TOKEN_TTL_MINUTES)
                );
            }
        });
    }

    /**
     * Invalidate a token immediately.
     */
    public function invalidateToken(string $token): void
    {
        // Use central cache context to avoid tenant tagging issues
        tenancy()->central(function () use ($token) {
            Cache::forget($this->getCacheKey($token));
        });
    }

    /**
     * Get the cache key for a token.
     */
    private function getCacheKey(string $token): string
    {
        return 'document_access_token:'.$token;
    }
}
