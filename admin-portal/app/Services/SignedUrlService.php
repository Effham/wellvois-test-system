<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Service for generating signed URLs on demand from S3 keys
 * Following S3 best practices: store only permanent S3 keys, generate URLs on demand
 */
class SignedUrlService
{
    protected S3BucketService $s3Service;

    public function __construct(S3BucketService $s3Service)
    {
        $this->s3Service = $s3Service;
    }

    /**
     * Generate a signed URL for a profile picture
     */
    public function getProfilePictureUrl(string $s3Key, int $expiresMinutes = 60): ?string
    {
        if (empty($s3Key)) {
            return null;
        }

        try {
            return $this->s3Service->temporaryUrl($s3Key, now()->addMinutes($expiresMinutes));
        } catch (\Exception $e) {
            Log::warning('Failed to generate profile picture signed URL', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate a signed URL for an organization logo
     */
    public function getLogoUrl(string $s3Key, int $expiresMinutes = 1440): ?string
    {
        if (empty($s3Key)) {
            return null;
        }

        try {
            return $this->s3Service->temporaryUrl($s3Key, now()->addMinutes($expiresMinutes));
        } catch (\Exception $e) {
            Log::warning('Failed to generate logo signed URL', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate a signed URL for a document
     */
    public function getDocumentUrl(string $s3Key, int $expiresMinutes = 30): ?string
    {
        if (empty($s3Key)) {
            return null;
        }

        try {
            return $this->s3Service->temporaryUrl($s3Key, now()->addMinutes($expiresMinutes));
        } catch (\Exception $e) {
            Log::warning('Failed to generate document signed URL', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate multiple signed URLs at once
     */
    public function generateMultipleUrls(array $s3Keys, int $expiresMinutes = 60): array
    {
        $urls = [];

        foreach ($s3Keys as $key => $s3Key) {
            if (! empty($s3Key)) {
                try {
                    $urls[$key] = $this->s3Service->temporaryUrl($s3Key, now()->addMinutes($expiresMinutes));
                } catch (\Exception $e) {
                    Log::warning('Failed to generate signed URL in batch', [
                        'key' => $key,
                        's3_key' => $s3Key,
                        'error' => $e->getMessage(),
                    ]);
                    $urls[$key] = null;
                }
            } else {
                $urls[$key] = null;
            }
        }

        return $urls;
    }
}
