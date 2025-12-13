<?php

namespace App\Http\Controllers\Examples;

use App\Http\Controllers\Controller;
use App\Services\S3FileTypeService;
use App\Services\S3PrivateBucketService;
use App\Services\S3StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Example controller showing how to use the S3 Storage Service
 * This controller demonstrates various use cases for the S3 storage system
 */
class S3StorageExampleController extends Controller
{
    protected S3StorageService $s3Service;

    protected S3FileTypeService $s3FileService;

    protected S3PrivateBucketService $privateBucketService;

    public function __construct(
        S3StorageService $s3Service,
        S3FileTypeService $s3FileService,
        S3PrivateBucketService $privateBucketService
    ) {
        $this->s3Service = $s3Service;
        $this->s3FileService = $s3FileService;
        $this->privateBucketService = $privateBucketService;
    }

    /**
     * Example 1: Upload a practitioner profile picture
     */
    public function uploadPractitionerProfile(Request $request): JsonResponse
    {
        $request->validate([
            'profile_picture' => 'required|image|max:2048',
            'practitioner_id' => 'required|integer',
        ]);

        $result = $this->s3FileService->uploadPractitionerProfilePicture(
            $request->file('profile_picture'),
            $request->practitioner_id,
            tenant('id')
        );

        if ($result['success']) {
            // Update practitioner record with new file path
            // Practitioner::find($request->practitioner_id)->update([
            //     'profile_picture_path' => $result['file_path']
            // ]);

            return response()->json([
                'message' => 'Profile picture uploaded successfully',
                'file_url' => $this->s3Service->getTemporaryUrl($result['file_path'], 60),
                'file_path' => $result['file_path'],
            ]);
        }

        return response()->json([
            'message' => 'Upload failed',
            'error' => $result['error'],
        ], 400);
    }

    /**
     * Example 2: Upload multiple practitioner documents
     */
    public function uploadPractitionerDocuments(Request $request): JsonResponse
    {
        $request->validate([
            'documents.*' => 'required|file|max:5120',
            'practitioner_id' => 'required|integer',
            'document_type' => 'required|in:resume_files,licensing_docs,certificates',
        ]);

        $result = $this->s3FileService->uploadPractitionerDocuments(
            $request->file('documents'),
            $request->practitioner_id,
            $request->document_type,
            tenant('id')
        );

        $successfulUploads = array_filter($result['results'], fn ($r) => $r['success']);

        if (! empty($successfulUploads)) {
            // Store file paths in database
            $filePaths = array_column($successfulUploads, 'file_path');

            // Example: Update practitioner with new document paths
            // $practitioner = Practitioner::find($request->practitioner_id);
            // $existingDocs = $practitioner->{$request->document_type} ?? [];
            // $practitioner->update([
            //     $request->document_type => array_merge($existingDocs, $filePaths)
            // ]);

            return response()->json([
                'message' => "{$result['summary']['success']} documents uploaded successfully",
                'summary' => $result['summary'],
                'uploaded_files' => $successfulUploads,
            ]);
        }

        return response()->json([
            'message' => 'All uploads failed',
            'summary' => $result['summary'],
        ], 400);
    }

    /**
     * Example 3: Upload medical encounter document
     */
    public function uploadEncounterDocument(Request $request): JsonResponse
    {
        $request->validate([
            'document' => 'required|file|max:10240',
            'encounter_id' => 'required|integer',
            'document_type' => 'nullable|string',
            'description' => 'nullable|string',
        ]);

        $result = $this->s3FileService->uploadEncounterDocument(
            $request->file('document'),
            $request->encounter_id,
            $request->document_type,
            tenant('id')
        );

        if ($result['success']) {
            // Create encounter document record
            // EncounterDocument::create([
            //     'encounter_id' => $request->encounter_id,
            //     'original_name' => $result['original_name'],
            //     'file_name' => $result['file_name'],
            //     'file_path' => $result['file_path'],
            //     'file_size' => $result['file_size'],
            //     'mime_type' => $result['mime_type'],
            //     'document_type' => $request->document_type,
            //     'description' => $request->description,
            //     'uploaded_by_type' => get_class(Auth::user()),
            //     'uploaded_by_id' => Auth::id(),
            // ]);

            return response()->json([
                'message' => 'Medical document uploaded successfully',
                'file_path' => $result['file_path'],
                // Note: Don't return direct URLs for medical documents
                // Use the download method with proper authentication
            ]);
        }

        return response()->json([
            'message' => 'Upload failed',
            'error' => $result['error'],
        ], 400);
    }

    /**
     * Example 4: Get temporary URL for medical document
     */
    public function getMedicalDocumentUrl(Request $request): JsonResponse
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        // In real implementation, verify user has permission to access this document
        // $document = EncounterDocument::where('file_path', $request->file_path)->first();
        // if (!$document || !$this->userCanAccessDocument(Auth::user(), $document)) {
        //     return response()->json(['message' => 'Access denied'], 403);
        // }

        $url = $this->s3FileService->getMedicalDocumentUrl($request->file_path, 30);

        if ($url) {
            return response()->json([
                'download_url' => $url,
                'expires_in_minutes' => 30,
            ]);
        }

        return response()->json([
            'message' => 'File not found or access denied',
        ], 404);
    }

    /**
     * Example 5: Upload organization logo
     */
    public function uploadOrganizationLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => 'required|image|max:2048',
        ]);

        $result = $this->s3FileService->uploadOrganizationLogo(
            $request->file('logo'),
            tenant('id')
        );

        if ($result['success']) {
            // Update organization settings
            // OrganizationSetting::setValue('appearance_logo_path', $result['file_path']);

            return response()->json([
                'message' => 'Logo uploaded successfully',
                'public_url' => $this->s3FileService->getPublicAssetUrl($result['file_path']),
                'file_path' => $result['file_path'],
            ]);
        }

        return response()->json([
            'message' => 'Upload failed',
            'error' => $result['error'],
        ], 400);
    }

    /**
     * Example 6: Basic file operations
     */
    public function fileOperations(Request $request): JsonResponse
    {
        $filePath = $request->input('file_path');

        // Check if file exists
        $exists = $this->s3Service->fileExists($filePath);

        // Get file metadata
        $metadata = $this->s3Service->getFileMetadata($filePath);

        // List files in directory
        $directory = dirname($filePath);
        $files = $this->s3Service->listFiles($directory);

        // Get storage statistics
        $stats = $this->s3Service->getStorageStats($directory);

        return response()->json([
            'file_exists' => $exists,
            'metadata' => $metadata,
            'directory_files' => $files,
            'storage_stats' => $stats,
        ]);
    }

    /**
     * Example 7: Delete files (with proper authorization)
     */
    public function deleteFile(Request $request): JsonResponse
    {
        $request->validate([
            'file_path' => 'required|string',
        ]);

        // In real implementation, verify permissions
        // if (!$this->userCanDeleteFile(Auth::user(), $request->file_path)) {
        //     return response()->json(['message' => 'Access denied'], 403);
        // }

        $deleted = $this->s3Service->deleteFile($request->file_path);

        if ($deleted) {
            // Also delete from database
            // Document::where('file_path', $request->file_path)->delete();

            return response()->json([
                'message' => 'File deleted successfully',
            ]);
        }

        return response()->json([
            'message' => 'Failed to delete file',
        ], 400);
    }

    /**
     * Example 8: Bulk operations
     */
    public function bulkOperations(Request $request): JsonResponse
    {
        $operation = $request->input('operation'); // 'delete', 'copy', 'move'
        $filePaths = $request->input('file_paths', []);

        switch ($operation) {
            case 'delete':
                $results = $this->s3Service->deleteMultipleFiles($filePaths);
                break;

            case 'copy':
                $targetPath = $request->input('target_path');
                $results = [];
                foreach ($filePaths as $filePath) {
                    $newPath = $targetPath.'/'.basename($filePath);
                    $results[$filePath] = $this->s3Service->copyFile($filePath, $newPath);
                }
                break;

            case 'move':
                $targetPath = $request->input('target_path');
                $results = [];
                foreach ($filePaths as $filePath) {
                    $newPath = $targetPath.'/'.basename($filePath);
                    $results[$filePath] = $this->s3Service->moveFile($filePath, $newPath);
                }
                break;

            default:
                return response()->json(['message' => 'Invalid operation'], 400);
        }

        return response()->json([
            'operation' => $operation,
            'results' => $results,
        ]);
    }

    /**
     * Example 9: Upload with custom options
     */
    public function uploadWithCustomOptions(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file',
            'category' => 'required|string',
        ]);

        $customOptions = [
            'tenant_id' => tenant('id'),
            'entity_id' => $request->input('entity_id'),
            'visibility' => $request->input('visibility', 'private'),
            'encrypt' => $request->boolean('encrypt', true),
            'custom_path' => $request->input('custom_path'),
            'max_size' => $request->input('max_size', 10240),
            'allowed_types' => $request->input('allowed_types', []),
            'allowed_extensions' => $request->input('allowed_extensions', []),
        ];

        $result = $this->s3Service->uploadFile(
            $request->file('file'),
            $request->category,
            $customOptions
        );

        return response()->json($result);
    }

    /**
     * Example 10: Health check and diagnostics (Private bucket aware)
     */
    public function healthCheck(): JsonResponse
    {
        try {
            // Get bucket info
            $bucketInfo = $this->s3Service->getBucketInfo();

            // Validate configuration
            $validation = $this->s3Service->validatePrivateBucketSetup();

            if (! $validation['valid']) {
                return response()->json([
                    'status' => 'unhealthy',
                    'message' => 'S3 configuration validation failed',
                    'errors' => $validation['errors'],
                    'warnings' => $validation['warnings'] ?? [],
                    'bucket_info' => $bucketInfo,
                    'timestamp' => now()->toISOString(),
                ], 500);
            }

            // Test basic S3 connectivity
            $testFile = 'health-check/test-'.time().'.txt';
            $testContent = 'S3 Health Check - '.now()->toISOString();

            // Test upload (automatically handles private bucket settings)
            $uploaded = $this->s3Service->uploadFile(
                new \Illuminate\Http\Testing\File('test.txt', fopen('data://text/plain,'.$testContent, 'r')),
                'health-check',
                ['encrypt' => $bucketInfo['is_private']]
            );

            if (! $uploaded['success']) {
                throw new \Exception('Upload test failed: '.$uploaded['error']);
            }

            // Test download
            $content = $this->s3Service->getFile($uploaded['file_path']);
            if ($content !== $testContent) {
                throw new \Exception('Download test failed: content mismatch');
            }

            // Test signed URL generation for private buckets
            $urlTest = null;
            if ($bucketInfo['is_private']) {
                $signedUrl = $this->s3Service->getTemporaryUrl($uploaded['file_path'], 5);
                $urlTest = [
                    'signed_url_generated' => ! empty($signedUrl),
                    'url_expires_in' => '5 minutes',
                ];
            }

            // Test delete
            $deleted = $this->s3Service->deleteFile($uploaded['file_path']);
            if (! $deleted) {
                throw new \Exception('Delete test failed');
            }

            return response()->json([
                'status' => 'healthy',
                'message' => 'All S3 operations working correctly',
                'bucket_info' => $bucketInfo,
                'validation' => $validation,
                'url_test' => $urlTest,
                'timestamp' => now()->toISOString(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unhealthy',
                'message' => 'S3 health check failed',
                'error' => $e->getMessage(),
                'bucket_info' => $this->s3Service->getBucketInfo(),
                'timestamp' => now()->toISOString(),
            ], 500);
        }
    }

    /**
     * Example 11: Private bucket validation endpoint
     */
    public function validatePrivateBucket(): JsonResponse
    {
        $validation = $this->privateBucketService->validatePrivateBucketSetup();
        $bucketInfo = $this->s3Service->getBucketInfo();

        return response()->json([
            'bucket_info' => $bucketInfo,
            'validation' => $validation,
            'recommendations' => $bucketInfo['is_private']
                ? $this->privateBucketService->setupPrivateBucketRecommendations()
                : null,
            'timestamp' => now()->toISOString(),
        ]);
    }
}
