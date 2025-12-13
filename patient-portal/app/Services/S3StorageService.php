<?php

namespace App\Services;

use Carbon\Carbon;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class S3StorageService
{
    protected string $disk;

    protected array $config;

    protected bool $isPrivateBucket;

    protected string $instanceId;

    public function __construct(string $disk = 's3')
    {
        $this->instanceId = uniqid('s3storage_', true);

        $this->disk = $disk;
        $this->config = config("filesystems.disks.{$disk}");

        if (empty($this->config)) {
            throw new Exception("S3 disk '{$disk}' is not configured.");
        }

        // Detect if this is a private bucket setup
        $this->isPrivateBucket = ($this->config['visibility'] ?? 'public') === 'private';
    }

    /**
     * Upload a file to S3 with proper organization and security
     */
    public function uploadFile(
        UploadedFile $file,
        string $category,
        array $options = []
    ): array {
        try {
            $tenantId = $options['tenant_id'] ?? tenant('id');
            $entityId = $options['entity_id'] ?? null;
            $visibility = $options['visibility'] ?? 'private';
            $encrypt = $options['encrypt'] ?? true;
            $customPath = $options['custom_path'] ?? null;

            // Validate file
            $this->validateFile($file, $options);

            // Generate file path
            $filePath = $customPath ?? $this->generateFilePath($category, $tenantId, $entityId, $file);

            // Prepare storage options
            $storageOptions = [
                'visibility' => $this->isPrivateBucket ? 'private' : $visibility,
                'ContentType' => $file->getMimeType(),
            ];

            // Force encryption for private buckets or when explicitly requested
            if ($encrypt || $this->isPrivateBucket) {
                $storageOptions['ServerSideEncryption'] = 'AES256';
            }

            // Add private bucket specific options
            if ($this->isPrivateBucket) {
                $storageOptions = array_merge($storageOptions, $this->config['options'] ?? []);
            }

            // Add metadata
            $storageOptions['Metadata'] = [
                'original_name' => $file->getClientOriginalName(),
                'uploaded_at' => now()->toISOString(),
                'tenant_id' => $tenantId,
                'category' => $category,
                'file_size' => $file->getSize(),
            ];

            if ($entityId) {
                $storageOptions['Metadata']['entity_id'] = $entityId;
            }

            // Upload to S3
            $uploadedPath = Storage::disk($this->disk)->putFileAs(
                dirname($filePath),
                $file,
                basename($filePath),
                $storageOptions
            );

            return [
                'success' => true,
                'file_path' => $uploadedPath,
                'file_name' => basename($uploadedPath),
                'original_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
                'url' => $this->getFileUrl($uploadedPath),
                'metadata' => $storageOptions['Metadata'],
            ];

        } catch (Exception $e) {
            try {
                Log::error('S3 file upload failed', [
                    'error' => $e->getMessage(),
                    'category' => $category,
                    'file_name' => $file->getClientOriginalName(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Upload multiple files at once
     */
    public function uploadMultipleFiles(
        array $files,
        string $category,
        array $options = []
    ): array {
        $results = [];
        $successCount = 0;
        $failureCount = 0;

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $result = $this->uploadFile($file, $category, $options);
                $results[] = $result;

                if ($result['success']) {
                    $successCount++;
                } else {
                    $failureCount++;
                }
            }
        }

        return [
            'results' => $results,
            'summary' => [
                'total' => count($files),
                'success' => $successCount,
                'failed' => $failureCount,
            ],
        ];
    }

    /**
     * Get a file from S3
     */
    public function getFile(string $filePath): ?string
    {
        try {
            if (! Storage::disk($this->disk)->exists($filePath)) {
                return null;
            }

            return Storage::disk($this->disk)->get($filePath);
        } catch (Exception $e) {
            try {
                Log::error('Failed to retrieve file from S3', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return null;
        }
    }

    /**
     * Get a temporary signed URL for private files
     */
    public function getTemporaryUrl(
        string $filePath,
        int $expirationMinutes = 60,
        ?string $contentType = null
    ): ?string {
        try {
            // For private buckets, we can generate signed URLs without checking existence
            // The URL will be invalid if the file doesn't exist, but checking existence
            // can fail due to permissions or other S3 issues
            if ($this->isPrivateBucket) {
                try {
                    // Try to check existence first, but don't fail if it errors
                    $exists = Storage::disk($this->disk)->exists($filePath);
                    // Continue anyway - the signed URL generation will fail if file doesn't exist
                } catch (Exception $checkException) {
                    // Silently continue - existence check can fail for various reasons
                }
            } else {
                // For public buckets, check existence
                if (! Storage::disk($this->disk)->exists($filePath)) {
                    return null;
                }
            }

            // Prepare options for signed URL generation
            $options = [];

            // If content type is provided, set response content type header
            // This helps browsers handle the file correctly
            if ($contentType) {
                $options['ResponseContentType'] = $contentType;
            }

            return Storage::disk($this->disk)->temporaryUrl(
                $filePath,
                Carbon::now()->addMinutes($expirationMinutes),
                $options
            );
        } catch (Exception $e) {
            try {
                Log::error('Failed to generate temporary URL', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return null;
        }
    }

    /**
     * Get file URL (automatically handles private vs public buckets)
     */
    public function getFileUrl(string $filePath, int $expirationMinutes = 60): string
    {
        if ($this->isPrivateBucket) {
            // For private buckets, always return signed URLs
            $signedUrl = $this->getTemporaryUrl($filePath, $expirationMinutes);

            return $signedUrl ?? '';
        }

        // For public buckets, return direct URL
        return Storage::disk($this->disk)->url($filePath);
    }

    /**
     * Download a file
     */
    public function downloadFile(string $filePath, ?string $downloadName = null): ?\Symfony\Component\HttpFoundation\StreamedResponse
    {
        try {
            if (! Storage::disk($this->disk)->exists($filePath)) {
                return null;
            }

            $downloadName = $downloadName ?? basename($filePath);

            return Storage::disk($this->disk)->download($filePath, $downloadName);
        } catch (Exception $e) {
            try {
                Log::error('Failed to download file from S3', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return null;
        }
    }

    /**
     * Delete a file from S3
     */
    public function deleteFile(string $filePath): bool
    {
        try {
            if (! Storage::disk($this->disk)->exists($filePath)) {
                return true; // File doesn't exist, consider it deleted
            }

            $deleted = Storage::disk($this->disk)->delete($filePath);

            return $deleted;
        } catch (Exception $e) {
            try {
                Log::error('Failed to delete file from S3', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return false;
        }
    }

    /**
     * Delete multiple files
     */
    public function deleteMultipleFiles(array $filePaths): array
    {
        $results = [];
        foreach ($filePaths as $filePath) {
            $results[$filePath] = $this->deleteFile($filePath);
        }

        return $results;
    }

    /**
     * Check if file exists
     */
    public function fileExists(string $filePath): bool
    {
        try {
            return Storage::disk($this->disk)->exists($filePath);
        } catch (Exception $e) {
            try {
                Log::error('Failed to check file existence', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return false;
        }
    }

    /**
     * Get file metadata
     */
    public function getFileMetadata(string $filePath): ?array
    {
        try {
            if (! Storage::disk($this->disk)->exists($filePath)) {
                return null;
            }

            $size = Storage::disk($this->disk)->size($filePath);
            $lastModified = Storage::disk($this->disk)->lastModified($filePath);
            $mimeType = Storage::disk($this->disk)->mimeType($filePath);

            return [
                'path' => $filePath,
                'size' => $size,
                'last_modified' => Carbon::createFromTimestamp($lastModified),
                'mime_type' => $mimeType,
            ];
        } catch (Exception $e) {
            try {
                Log::error('Failed to get file metadata', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return null;
        }
    }

    /**
     * Copy file to another location
     */
    public function copyFile(string $fromPath, string $toPath): bool
    {
        try {
            if (! Storage::disk($this->disk)->exists($fromPath)) {
                return false;
            }

            return Storage::disk($this->disk)->copy($fromPath, $toPath);
        } catch (Exception $e) {
            try {
                Log::error('Failed to copy file in S3', [
                    'from_path' => $fromPath,
                    'to_path' => $toPath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return false;
        }
    }

    /**
     * Move file to another location
     */
    public function moveFile(string $fromPath, string $toPath): bool
    {
        try {
            if (! Storage::disk($this->disk)->exists($fromPath)) {
                return false;
            }

            return Storage::disk($this->disk)->move($fromPath, $toPath);
        } catch (Exception $e) {
            try {
                Log::error('Failed to move file in S3', [
                    'from_path' => $fromPath,
                    'to_path' => $toPath,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return false;
        }
    }

    /**
     * List files in a directory
     */
    public function listFiles(string $directory = '', bool $recursive = false): array
    {
        try {
            if ($recursive) {
                return Storage::disk($this->disk)->allFiles($directory);
            } else {
                return Storage::disk($this->disk)->files($directory);
            }
        } catch (Exception $e) {
            try {
                Log::error('Failed to list files in S3', [
                    'directory' => $directory,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return [];
        }
    }

    /**
     * Generate organized file path
     */
    protected function generateFilePath(
        string $category,
        ?string $tenantId,
        ?string $entityId,
        UploadedFile $file
    ): string {
        $extension = $file->getClientOriginalExtension();
        $filename = Str::random(40).'.'.$extension;

        $pathParts = ['uploads', $category];

        if ($tenantId) {
            $pathParts[] = "tenant_{$tenantId}";
        }

        if ($entityId) {
            $pathParts[] = "entity_{$entityId}";
        }

        // Add date-based organization
        $pathParts[] = now()->format('Y/m');
        $pathParts[] = $filename;

        return implode('/', $pathParts);
    }

    /**
     * Validate uploaded file
     */
    protected function validateFile(UploadedFile $file, array $options = []): void
    {
        if (! $file->isValid()) {
            throw new Exception('Invalid file upload.');
        }

        // Check file size (default 10MB)
        $maxSize = $options['max_size'] ?? 10240; // KB
        if ($file->getSize() > $maxSize * 1024) {
            throw new Exception("File size exceeds maximum allowed size of {$maxSize}KB.");
        }

        // Check allowed mime types
        if (isset($options['allowed_types']) && ! in_array($file->getMimeType(), $options['allowed_types'])) {
            throw new Exception('File type not allowed.');
        }

        // Check allowed extensions
        if (isset($options['allowed_extensions'])) {
            $extension = strtolower($file->getClientOriginalExtension());
            if (! in_array($extension, $options['allowed_extensions'])) {
                throw new Exception('File extension not allowed.');
            }
        }
    }

    /**
     * Get storage statistics
     */
    public function getStorageStats(string $prefix = ''): array
    {
        try {
            $files = $this->listFiles($prefix, true);
            $totalSize = 0;
            $fileCount = count($files);

            foreach ($files as $file) {
                $size = Storage::disk($this->disk)->size($file);
                $totalSize += $size;
            }

            return [
                'file_count' => $fileCount,
                'total_size' => $totalSize,
                'total_size_formatted' => $this->formatBytes($totalSize),
            ];
        } catch (Exception $e) {
            try {
                Log::error('Failed to get storage statistics', [
                    'prefix' => $prefix,
                    'error' => $e->getMessage(),
                ]);
            } catch (Exception $logException) {
                // Silently fail if logging itself fails
            }

            return [
                'file_count' => 0,
                'total_size' => 0,
                'total_size_formatted' => '0 B',
            ];
        }
    }

    /**
     * Check if bucket is configured as private
     */
    public function isPrivateBucket(): bool
    {
        return $this->isPrivateBucket;
    }

    /**
     * Get bucket configuration info
     */
    public function getBucketInfo(): array
    {
        return [
            'disk' => $this->disk,
            'bucket' => $this->config['bucket'] ?? 'not_configured',
            'region' => $this->config['region'] ?? 'not_configured',
            'is_private' => $this->isPrivateBucket,
            'encryption_enabled' => ! empty($this->config['options']['ServerSideEncryption']),
            'encryption_type' => $this->config['options']['ServerSideEncryption'] ?? null,
        ];
    }

    /**
     * Validate private bucket setup
     */
    public function validatePrivateBucketSetup(): array
    {
        if (! $this->isPrivateBucket) {
            return [
                'valid' => true,
                'message' => 'Not configured as private bucket',
                'is_private' => false,
            ];
        }

        $validation = [];
        $errors = [];
        $warnings = [];

        // Check required configuration
        if (empty($this->config['bucket'])) {
            $errors[] = 'Bucket name not configured';
        }

        if (empty($this->config['key']) || empty($this->config['secret'])) {
            $errors[] = 'AWS credentials not configured';
        }

        if (empty($this->config['region'])) {
            $errors[] = 'AWS region not configured';
        }

        // Check encryption
        if (empty($this->config['options']['ServerSideEncryption'])) {
            $warnings[] = 'Server-side encryption not configured';
        }

        // Test connectivity
        try {
            $testResult = $this->testBucketConnectivity();
            if (! $testResult['success']) {
                $errors[] = 'Bucket connectivity test failed: '.$testResult['error'];
            }
        } catch (Exception $e) {
            $errors[] = 'Connectivity test error: '.$e->getMessage();
        }

        return [
            'valid' => empty($errors),
            'is_private' => $this->isPrivateBucket,
            'errors' => $errors,
            'warnings' => $warnings,
            'bucket_info' => $this->getBucketInfo(),
        ];
    }

    /**
     * Test bucket connectivity
     */
    protected function testBucketConnectivity(): array
    {
        try {
            // Test basic connectivity by listing files
            Storage::disk($this->disk)->files('', false);

            return [
                'success' => true,
                'message' => 'Bucket connectivity successful',
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Format bytes to human readable format
     */
    protected function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision).' '.$units[$i];
    }
}
