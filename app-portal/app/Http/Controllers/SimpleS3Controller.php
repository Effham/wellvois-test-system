<?php

namespace App\Http\Controllers;

use App\Services\S3StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SimpleS3Controller extends Controller
{
    protected S3StorageService $s3Service;

    public function __construct(S3StorageService $s3Service)
    {
        $this->s3Service = $s3Service;
    }

    /**
     * Upload a file to S3
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file' => 'required|file|max:10240', // 10MB max
                'category' => 'nullable|string|max:50',
            ]);

            $category = $request->input('category', 'uploads');

            $result = $this->s3Service->uploadFile(
                $request->file('file'),
                $category,
                [
                    'tenant_id' => 'demo', // Using demo tenant for testing
                    'encrypt' => true,
                    'visibility' => 'private',
                ]
            );

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'File uploaded successfully',
                    'data' => [
                        'file_path' => $result['file_path'],
                        'original_name' => $result['original_name'],
                        'file_size' => $result['file_size'],
                        'mime_type' => $result['mime_type'],
                        'file_name' => $result['file_name'],
                        'category' => $category,
                        // Generate access URL (signed URL for private buckets)
                        'access_url' => $this->s3Service->getFileUrl($result['file_path'], 60),
                        'uploaded_at' => now()->toISOString(),
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Upload failed',
                'error' => $result['error'],
            ], 400);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Simple S3 upload failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Upload failed due to server error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get file information and download URL
     */
    public function get(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file_path' => 'required|string',
                'expiration' => 'nullable|integer|min:1|max:1440', // Max 24 hours
            ]);

            $filePath = $request->input('file_path');
            $expiration = $request->input('expiration', 60); // Default 1 hour

            // Check if file exists
            if (! $this->s3Service->fileExists($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                    'file_path' => $filePath,
                ], 404);
            }

            // Get file metadata
            $metadata = $this->s3Service->getFileMetadata($filePath);

            // Generate access URL
            $accessUrl = $this->s3Service->getFileUrl($filePath, $expiration);

            // For private buckets, also provide temporary download URL
            $downloadUrl = null;
            if ($this->s3Service->isPrivateBucket()) {
                $downloadUrl = $this->s3Service->getTemporaryUrl($filePath, $expiration);
            }

            return response()->json([
                'success' => true,
                'message' => 'File information retrieved successfully',
                'data' => [
                    'file_path' => $filePath,
                    'file_size' => $metadata['size'] ?? 0,
                    'file_size_formatted' => $this->formatBytes($metadata['size'] ?? 0),
                    'mime_type' => $metadata['mime_type'] ?? 'unknown',
                    'last_modified' => $metadata['last_modified'] ?? null,
                    'access_url' => $accessUrl,
                    'download_url' => $downloadUrl,
                    'expires_in_minutes' => $expiration,
                    'expires_at' => now()->addMinutes($expiration)->toISOString(),
                    'is_private_bucket' => $this->s3Service->isPrivateBucket(),
                ],
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Simple S3 get failed', [
                'error' => $e->getMessage(),
                'file_path' => $request->input('file_path'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve file information',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download file directly
     */
    public function download(Request $request)
    {
        try {
            $request->validate([
                'file_path' => 'required|string',
            ]);

            $filePath = $request->input('file_path');

            // Check if file exists
            if (! $this->s3Service->fileExists($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            // For private buckets, redirect to signed URL
            if ($this->s3Service->isPrivateBucket()) {
                $signedUrl = $this->s3Service->getTemporaryUrl($filePath, 60);
                if ($signedUrl) {
                    return redirect($signedUrl);
                }
            }

            // For public buckets or if signed URL fails, try direct download
            $downloadResponse = $this->s3Service->downloadFile($filePath);

            if ($downloadResponse) {
                return $downloadResponse;
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to download file',
            ], 500);

        } catch (\Exception $e) {
            Log::error('Simple S3 download failed', [
                'error' => $e->getMessage(),
                'file_path' => $request->input('file_path'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Download failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a file
     */
    public function delete(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file_path' => 'required|string',
            ]);

            $filePath = $request->input('file_path');

            // Check if file exists
            if (! $this->s3Service->fileExists($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            $deleted = $this->s3Service->deleteFile($filePath);

            if ($deleted) {
                return response()->json([
                    'success' => true,
                    'message' => 'File deleted successfully',
                    'file_path' => $filePath,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete file',
            ], 500);

        } catch (\Exception $e) {
            Log::error('Simple S3 delete failed', [
                'error' => $e->getMessage(),
                'file_path' => $request->input('file_path'),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Delete failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * List files in a category/directory
     */
    public function list(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'category' => 'nullable|string|max:100',
                'limit' => 'nullable|integer|min:1|max:100',
            ]);

            $category = $request->input('category', 'uploads');
            $limit = $request->input('limit', 20);

            // Build directory path
            $directory = "uploads/{$category}/tenant_demo/";

            $files = $this->s3Service->listFiles($directory, true);

            // Limit results
            $files = array_slice($files, 0, $limit);

            $fileList = [];
            foreach ($files as $filePath) {
                $metadata = $this->s3Service->getFileMetadata($filePath);
                $fileList[] = [
                    'file_path' => $filePath,
                    'file_name' => basename($filePath),
                    'file_size' => $metadata['size'] ?? 0,
                    'file_size_formatted' => $this->formatBytes($metadata['size'] ?? 0),
                    'mime_type' => $metadata['mime_type'] ?? 'unknown',
                    'last_modified' => $metadata['last_modified'] ?? null,
                    'access_url' => $this->s3Service->getFileUrl($filePath, 60),
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Files listed successfully',
                'data' => [
                    'files' => $fileList,
                    'total_count' => count($fileList),
                    'category' => $category,
                    'directory' => $directory,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Simple S3 list failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to list files',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get S3 service status and bucket info
     */
    public function status(): JsonResponse
    {
        try {
            $bucketInfo = $this->s3Service->getBucketInfo();
            $validation = $this->s3Service->validatePrivateBucketSetup();

            return response()->json([
                'success' => true,
                'message' => 'S3 service status retrieved',
                'data' => [
                    'bucket_info' => $bucketInfo,
                    'validation' => $validation,
                    'service_ready' => $validation['valid'],
                    'timestamp' => now()->toISOString(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get service status',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision).' '.$units[$i];
    }
}
