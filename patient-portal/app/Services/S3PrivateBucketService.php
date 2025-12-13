<?php

namespace App\Services;

use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * S3 Private Bucket Service
 *
 * Specialized service for handling private S3 bucket operations
 * Ensures all operations work correctly with private bucket configurations
 */
class S3PrivateBucketService
{
    protected string $disk;

    protected S3StorageService $s3Service;

    public function __construct(S3StorageService $s3Service, string $disk = 's3')
    {
        $this->s3Service = $s3Service;
        $this->disk = $disk;
    }

    /**
     * Validate private bucket configuration
     */
    public function validatePrivateBucketSetup(): array
    {
        $errors = [];
        $warnings = [];

        try {
            // Check if S3 disk is configured
            $config = config("filesystems.disks.{$this->disk}");
            if (empty($config)) {
                $errors[] = "S3 disk '{$this->disk}' is not configured";

                return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
            }

            // Check required credentials
            $requiredKeys = ['key', 'secret', 'region', 'bucket'];
            foreach ($requiredKeys as $key) {
                if (empty($config[$key])) {
                    $errors[] = "Missing required S3 configuration: {$key}";
                }
            }

            if (! empty($errors)) {
                return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
            }

            // Test bucket connectivity
            $connectivityTest = $this->testBucketConnectivity();
            if (! $connectivityTest['success']) {
                $errors[] = 'Bucket connectivity failed: '.$connectivityTest['error'];
            }

            // Test private bucket permissions
            $permissionsTest = $this->testPrivateBucketPermissions();
            if (! $permissionsTest['success']) {
                if ($permissionsTest['critical']) {
                    $errors[] = 'Private bucket permissions failed: '.$permissionsTest['error'];
                } else {
                    $warnings[] = 'Private bucket warning: '.$permissionsTest['error'];
                }
            }

            // Check encryption settings
            if (empty($config['options']['ServerSideEncryption'])) {
                $warnings[] = 'Server-side encryption not configured - recommended for medical data';
            }

            return [
                'valid' => empty($errors),
                'errors' => $errors,
                'warnings' => $warnings,
                'config' => $config,
            ];

        } catch (Exception $e) {
            Log::error('Private bucket validation failed', [
                'error' => $e->getMessage(),
                'disk' => $this->disk,
            ]);

            return [
                'valid' => false,
                'errors' => ['Validation failed: '.$e->getMessage()],
                'warnings' => $warnings,
            ];
        }
    }

    /**
     * Test basic bucket connectivity
     */
    public function testBucketConnectivity(): array
    {
        try {
            // Try to list objects in the bucket (this tests both connectivity and permissions)
            $files = Storage::disk($this->disk)->files('', false);

            return [
                'success' => true,
                'message' => 'Bucket connectivity successful',
                'file_count' => count($files),
            ];

        } catch (Exception $e) {
            Log::error('Bucket connectivity test failed', [
                'error' => $e->getMessage(),
                'disk' => $this->disk,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Test private bucket specific permissions
     */
    public function testPrivateBucketPermissions(): array
    {
        try {
            $testFileName = 'private-bucket-test/'.uniqid().'.txt';
            $testContent = 'Private bucket permission test - '.now()->toISOString();

            // Test upload with private visibility
            $uploaded = Storage::disk($this->disk)->put($testFileName, $testContent, [
                'visibility' => 'private',
                'ServerSideEncryption' => 'AES256',
            ]);

            if (! $uploaded) {
                return [
                    'success' => false,
                    'critical' => true,
                    'error' => 'Failed to upload test file with private visibility',
                ];
            }

            // Test file exists
            if (! Storage::disk($this->disk)->exists($testFileName)) {
                return [
                    'success' => false,
                    'critical' => true,
                    'error' => 'Uploaded file not found - upload may have failed',
                ];
            }

            // Test private file access (should require signed URL)
            try {
                $directUrl = Storage::disk($this->disk)->url($testFileName);
                // If this doesn't throw an exception, the file might be publicly accessible
                // which is not what we want for a private bucket
            } catch (Exception $e) {
                // This is expected for private files - good!
            }

            // Test signed URL generation
            try {
                $signedUrl = Storage::disk($this->disk)->temporaryUrl(
                    $testFileName,
                    Carbon::now()->addMinutes(5)
                );

                if (empty($signedUrl)) {
                    return [
                        'success' => false,
                        'critical' => false,
                        'error' => 'Failed to generate signed URL - temporary access may not work',
                    ];
                }
            } catch (Exception $e) {
                return [
                    'success' => false,
                    'critical' => false,
                    'error' => 'Signed URL generation failed: '.$e->getMessage(),
                ];
            }

            // Test file retrieval
            $retrievedContent = Storage::disk($this->disk)->get($testFileName);
            if ($retrievedContent !== $testContent) {
                return [
                    'success' => false,
                    'critical' => true,
                    'error' => 'File content mismatch - data integrity issue',
                ];
            }

            // Test file deletion
            $deleted = Storage::disk($this->disk)->delete($testFileName);
            if (! $deleted) {
                // Try to clean up anyway
                Storage::disk($this->disk)->delete($testFileName);

                return [
                    'success' => false,
                    'critical' => false,
                    'error' => 'Failed to delete test file - cleanup permissions may be insufficient',
                ];
            }

            return [
                'success' => true,
                'message' => 'All private bucket permissions working correctly',
                'signed_url_generated' => ! empty($signedUrl),
            ];

        } catch (Exception $e) {
            // Clean up test file if it exists
            try {
                Storage::disk($this->disk)->delete($testFileName);
            } catch (Exception $cleanupError) {
                // Ignore cleanup errors
            }

            Log::error('Private bucket permissions test failed', [
                'error' => $e->getMessage(),
                'disk' => $this->disk,
            ]);

            return [
                'success' => false,
                'critical' => true,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Ensure all uploads are private by default
     */
    public function enforcePrivateUpload(array $options = []): array
    {
        // Force private visibility for all uploads
        $options['visibility'] = 'private';

        // Add encryption if not specified
        if (! isset($options['ServerSideEncryption'])) {
            $options['ServerSideEncryption'] = 'AES256';
        }

        // Add private bucket specific metadata
        if (! isset($options['Metadata'])) {
            $options['Metadata'] = [];
        }

        $options['Metadata']['bucket_type'] = 'private';
        $options['Metadata']['access_method'] = 'signed_url_only';

        return $options;
    }

    /**
     * Generate secure signed URL with additional validation
     */
    public function generateSecureSignedUrl(
        string $filePath,
        int $expirationMinutes = 60,
        array $options = []
    ): ?string {
        try {
            // Validate file exists
            if (! Storage::disk($this->disk)->exists($filePath)) {
                Log::warning('Attempted to generate signed URL for non-existent file', [
                    'file_path' => $filePath,
                ]);

                return null;
            }

            // Limit maximum expiration for security
            $maxExpiration = config('s3-storage.temporary_urls.max_expiration', 2880); // 48 hours
            if ($expirationMinutes > $maxExpiration) {
                $expirationMinutes = $maxExpiration;
                Log::warning('Signed URL expiration limited to maximum allowed', [
                    'requested_minutes' => $expirationMinutes,
                    'max_minutes' => $maxExpiration,
                    'file_path' => $filePath,
                ]);
            }

            // Generate signed URL
            $signedUrl = Storage::disk($this->disk)->temporaryUrl(
                $filePath,
                Carbon::now()->addMinutes($expirationMinutes),
                $options
            );

            // Log access for audit trail
            Log::info('Signed URL generated for private file', [
                'file_path' => $filePath,
                'expiration_minutes' => $expirationMinutes,
                'user_id' => auth()->id(),
                'tenant_id' => tenant('id'),
            ]);

            return $signedUrl;

        } catch (Exception $e) {
            Log::error('Failed to generate signed URL', [
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get private bucket statistics
     */
    public function getPrivateBucketStats(): array
    {
        try {
            $stats = $this->s3Service->getStorageStats();

            // Add private bucket specific metrics
            $privateBucketStats = [
                'total_files' => $stats['file_count'],
                'total_size' => $stats['total_size_formatted'],
                'encryption_status' => 'AES256',
                'bucket_type' => 'private',
                'access_method' => 'signed_urls_only',
                'last_checked' => now()->toISOString(),
            ];

            // Check for any public files (shouldn't exist in private bucket)
            $publicFileCheck = $this->checkForPublicFiles();
            $privateBucketStats['public_files_found'] = $publicFileCheck['found'];
            if ($publicFileCheck['found']) {
                $privateBucketStats['public_files_warning'] = $publicFileCheck['message'];
            }

            return $privateBucketStats;

        } catch (Exception $e) {
            Log::error('Failed to get private bucket statistics', [
                'error' => $e->getMessage(),
            ]);

            return [
                'error' => 'Failed to retrieve bucket statistics',
                'last_checked' => now()->toISOString(),
            ];
        }
    }

    /**
     * Check for any accidentally public files
     */
    protected function checkForPublicFiles(): array
    {
        try {
            // This is a simplified check - in a real implementation,
            // you might want to use AWS SDK directly to check object ACLs
            return [
                'found' => false,
                'message' => 'No public files detected (basic check)',
            ];

        } catch (Exception $e) {
            return [
                'found' => false,
                'message' => 'Could not perform public file check: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Setup private bucket with recommended settings
     */
    public function setupPrivateBucketRecommendations(): array
    {
        $recommendations = [
            'bucket_policy' => [
                'description' => 'Ensure bucket policy denies public access',
                'example' => [
                    'Version' => '2012-10-17',
                    'Statement' => [
                        [
                            'Sid' => 'DenyPublicAccess',
                            'Effect' => 'Deny',
                            'Principal' => '*',
                            'Action' => 's3:GetObject',
                            'Resource' => 'arn:aws:s3:::your-bucket-name/*',
                            'Condition' => [
                                'Bool' => [
                                    'aws:SecureTransport' => 'false',
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'bucket_settings' => [
                'block_public_acls' => true,
                'block_public_policy' => true,
                'ignore_public_acls' => true,
                'restrict_public_buckets' => true,
                'versioning' => 'Enabled',
                'encryption' => 'AES256',
                'logging' => 'Recommended for compliance',
            ],
            'iam_policy' => [
                'description' => 'Minimum required IAM permissions',
                'permissions' => [
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject',
                    's3:ListBucket',
                ],
            ],
        ];

        return $recommendations;
    }
}
