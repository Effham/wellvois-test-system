<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

class S3FileTypeService
{
    protected S3StorageService $s3Service;

    public function __construct(S3StorageService $s3Service)
    {
        $this->s3Service = $s3Service;
    }

    /**
     * Upload practitioner profile picture
     */
    public function uploadPractitionerProfilePicture(
        UploadedFile $file,
        int $practitionerId,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, 'practitioner/profile_pictures', [
            'tenant_id' => $tenantId,
            'entity_id' => $practitionerId,
            'encrypt' => true,
            'visibility' => 'private',
            'allowed_types' => ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'],
            'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif'],
            'max_size' => 2048, // 2MB
        ]);
    }

    /**
     * Upload practitioner documents (resume, licenses, certificates)
     */
    public function uploadPractitionerDocument(
        UploadedFile $file,
        int $practitionerId,
        string $documentType,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, "practitioner/documents/{$documentType}", [
            'tenant_id' => $tenantId,
            'entity_id' => $practitionerId,
            'encrypt' => true,
            'visibility' => 'private',
            'allowed_types' => [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png',
                'image/jpg',
            ],
            'allowed_extensions' => ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
            'max_size' => 5120, // 5MB
        ]);
    }

    /**
     * Upload multiple practitioner documents
     */
    public function uploadPractitionerDocuments(
        array $files,
        int $practitionerId,
        string $documentType,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadMultipleFiles($files, "practitioner/documents/{$documentType}", [
            'tenant_id' => $tenantId,
            'entity_id' => $practitionerId,
            'encrypt' => true,
            'visibility' => 'private',
            'allowed_types' => [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png',
                'image/jpg',
            ],
            'allowed_extensions' => ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
            'max_size' => 5120, // 5MB
        ]);
    }

    /**
     * Upload patient encounter document (HIPAA compliant)
     */
    public function uploadEncounterDocument(
        UploadedFile $file,
        int $encounterId,
        ?string $documentType = null,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, 'encounters/documents', [
            'tenant_id' => $tenantId,
            'entity_id' => $encounterId,
            'encrypt' => true,
            'visibility' => 'private',
            'max_size' => 10240, // 10MB
            'custom_path' => "medical/encounters/{$tenantId}/{$encounterId}/".
                           now()->format('Y/m/').
                           uniqid().'.'.$file->getClientOriginalExtension(),
        ]);
    }

    /**
     * Upload patient intake coverage card
     */
    public function uploadCoverageCard(
        UploadedFile $file,
        int $patientId,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, 'patients/coverage_cards', [
            'tenant_id' => $tenantId,
            'entity_id' => $patientId,
            'encrypt' => true,
            'visibility' => 'private',
            'allowed_types' => [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/jpg',
            ],
            'allowed_extensions' => ['pdf', 'jpg', 'jpeg', 'png'],
            'max_size' => 2048, // 2MB
        ]);
    }

    /**
     * Upload organization logo
     */
    public function uploadOrganizationLogo(
        UploadedFile $file,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, 'organization/logos', [
            'tenant_id' => $tenantId,
            'encrypt' => false,
            'visibility' => 'public',
            'allowed_types' => [
                'image/jpeg',
                'image/png',
                'image/jpg',
                'image/gif',
                'image/svg+xml',
            ],
            'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg'],
            'max_size' => 2048, // 2MB
        ]);
    }

    /**
     * Upload medical report or lab result
     */
    public function uploadMedicalReport(
        UploadedFile $file,
        int $patientId,
        string $reportType,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, "medical/reports/{$reportType}", [
            'tenant_id' => $tenantId,
            'entity_id' => $patientId,
            'encrypt' => true,
            'visibility' => 'private',
            'allowed_types' => [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/jpg',
                'application/dicom', // For medical imaging
            ],
            'allowed_extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'dcm'],
            'max_size' => 20480, // 20MB for medical imaging
            'custom_path' => "medical/reports/{$tenantId}/{$patientId}/{$reportType}/".
                           now()->format('Y/m/').
                           uniqid().'.'.$file->getClientOriginalExtension(),
        ]);
    }

    /**
     * Upload backup file
     */
    public function uploadBackupFile(
        UploadedFile $file,
        string $backupType,
        ?string $tenantId = null
    ): array {
        return $this->s3Service->uploadFile($file, "backups/{$backupType}", [
            'tenant_id' => $tenantId,
            'encrypt' => true,
            'visibility' => 'private',
            'max_size' => 1048576, // 1GB
            'custom_path' => "backups/{$tenantId}/{$backupType}/".
                           now()->format('Y/m/d/').
                           now()->format('His').'_'.$file->getClientOriginalName(),
        ]);
    }

    /**
     * Get temporary URL for medical document (HIPAA compliant)
     */
    public function getMedicalDocumentUrl(
        string $filePath,
        int $expirationMinutes = 30
    ): ?string {
        // Shorter expiration for medical documents for security
        return $this->s3Service->getTemporaryUrl($filePath, $expirationMinutes);
    }

    /**
     * Get public URL for organization assets
     */
    public function getPublicAssetUrl(string $filePath): string
    {
        return $this->s3Service->getFileUrl($filePath);
    }

    /**
     * Delete practitioner files when practitioner is removed
     */
    public function deletePractitionerFiles(
        int $practitionerId,
        ?string $tenantId = null
    ): array {
        $patterns = [
            "uploads/practitioner/profile_pictures/tenant_{$tenantId}/entity_{$practitionerId}/",
            "uploads/practitioner/documents/resume_files/tenant_{$tenantId}/entity_{$practitionerId}/",
            "uploads/practitioner/documents/licensing_docs/tenant_{$tenantId}/entity_{$practitionerId}/",
            "uploads/practitioner/documents/certificates/tenant_{$tenantId}/entity_{$practitionerId}/",
        ];

        $deletedFiles = [];
        foreach ($patterns as $pattern) {
            $files = $this->s3Service->listFiles($pattern, true);
            foreach ($files as $file) {
                $deletedFiles[$file] = $this->s3Service->deleteFile($file);
            }
        }

        return $deletedFiles;
    }

    /**
     * Delete patient files when patient record is removed
     */
    public function deletePatientFiles(
        int $patientId,
        ?string $tenantId = null
    ): array {
        $patterns = [
            "uploads/patients/coverage_cards/tenant_{$tenantId}/entity_{$patientId}/",
            "medical/encounters/{$tenantId}/", // Will need additional filtering by patient
            "medical/reports/{$tenantId}/{$patientId}/",
        ];

        $deletedFiles = [];
        foreach ($patterns as $pattern) {
            $files = $this->s3Service->listFiles($pattern, true);
            foreach ($files as $file) {
                $deletedFiles[$file] = $this->s3Service->deleteFile($file);
            }
        }

        return $deletedFiles;
    }

    /**
     * Get file type configuration for different categories
     */
    public function getFileTypeConfig(string $category): array
    {
        $configs = [
            'practitioner_profile' => [
                'allowed_types' => ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'],
                'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif'],
                'max_size' => 2048,
                'encrypt' => true,
                'visibility' => 'private',
            ],
            'practitioner_documents' => [
                'allowed_types' => [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg',
                    'image/png',
                ],
                'allowed_extensions' => ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
                'max_size' => 5120,
                'encrypt' => true,
                'visibility' => 'private',
            ],
            'medical_documents' => [
                'allowed_types' => [
                    'application/pdf',
                    'image/jpeg',
                    'image/png',
                    'application/dicom',
                ],
                'allowed_extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'dcm'],
                'max_size' => 20480,
                'encrypt' => true,
                'visibility' => 'private',
            ],
            'organization_assets' => [
                'allowed_types' => [
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/svg+xml',
                ],
                'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg'],
                'max_size' => 2048,
                'encrypt' => false,
                'visibility' => 'public',
            ],
        ];

        return $configs[$category] ?? [];
    }
}
