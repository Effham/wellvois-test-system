<?php

return [
    /*
    |--------------------------------------------------------------------------
    | S3 Storage Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration options for the S3 storage service used throughout
    | the EMR application for secure file storage and retrieval.
    |
    */

    'default_disk' => env('S3_STORAGE_DISK', 's3'),

    /*
    |--------------------------------------------------------------------------
    | File Categories and Security Settings
    |--------------------------------------------------------------------------
    */

    'categories' => [
        'medical_documents' => [
            'encrypt' => true,
            'visibility' => 'private',
            'retention_years' => 7, // Medical record retention
            'backup_enabled' => true,
            'audit_access' => true,
        ],
        'practitioner_documents' => [
            'encrypt' => true,
            'visibility' => 'private',
            'retention_years' => 5,
            'backup_enabled' => true,
            'audit_access' => true,
        ],
        'patient_files' => [
            'encrypt' => true,
            'visibility' => 'private',
            'retention_years' => 7,
            'backup_enabled' => true,
            'audit_access' => true,
        ],
        'organization_assets' => [
            'encrypt' => false,
            'visibility' => 'public',
            'retention_years' => 1,
            'backup_enabled' => false,
            'audit_access' => false,
        ],
        'system_backups' => [
            'encrypt' => true,
            'visibility' => 'private',
            'retention_years' => 3,
            'backup_enabled' => false, // Backups don't need backups
            'audit_access' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | File Type Restrictions
    |--------------------------------------------------------------------------
    */

    'file_types' => [
        'images' => [
            'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg'],
            'mime_types' => [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/svg+xml',
            ],
            'max_size' => 5120, // 5MB in KB
        ],
        'documents' => [
            'extensions' => ['pdf', 'doc', 'docx', 'txt'],
            'mime_types' => [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
            ],
            'max_size' => 10240, // 10MB in KB
        ],
        'medical_files' => [
            'extensions' => ['pdf', 'dcm', 'jpg', 'jpeg', 'png'],
            'mime_types' => [
                'application/pdf',
                'application/dicom',
                'image/jpeg',
                'image/png',
            ],
            'max_size' => 51200, // 50MB in KB for medical imaging
        ],
        'archives' => [
            'extensions' => ['zip', 'tar', 'gz'],
            'mime_types' => [
                'application/zip',
                'application/x-tar',
                'application/gzip',
            ],
            'max_size' => 1048576, // 1GB in KB
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Temporary URL Settings
    |--------------------------------------------------------------------------
    */

    'temporary_urls' => [
        'default_expiration' => 60, // minutes
        'medical_documents' => 30, // shorter for sensitive files
        'practitioner_documents' => 60,
        'organization_assets' => 1440, // 24 hours
        'max_expiration' => 2880, // 48 hours maximum
    ],

    /*
    |--------------------------------------------------------------------------
    | Path Organization
    |--------------------------------------------------------------------------
    */

    'path_structure' => [
        'use_tenant_isolation' => true,
        'use_date_folders' => true,
        'date_format' => 'Y/m', // Year/Month
        'use_entity_folders' => true,
        'random_filename' => true,
        'filename_length' => 40,
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    */

    'security' => [
        'default_encryption' => 'AES256',
        'require_encryption_for_medical' => true,
        'virus_scanning' => env('S3_VIRUS_SCANNING', false),
        'access_logging' => true,
        'ip_restrictions' => env('S3_IP_RESTRICTIONS', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Performance and Storage Optimization
    |--------------------------------------------------------------------------
    */

    'optimization' => [
        'enable_multipart_upload' => true,
        'multipart_threshold' => 8388608, // 8MB
        'use_transfer_acceleration' => env('S3_TRANSFER_ACCELERATION', false),
        'enable_intelligent_tiering' => true,
        'lifecycle_rules' => [
            'transition_to_ia' => 30, // days to Infrequent Access
            'transition_to_glacier' => 90, // days to Glacier
            'transition_to_deep_archive' => 365, // days to Deep Archive
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Backup and Disaster Recovery
    |--------------------------------------------------------------------------
    */

    'backup' => [
        'cross_region_replication' => env('S3_CROSS_REGION_BACKUP', false),
        'backup_region' => env('S3_BACKUP_REGION', 'us-east-1'),
        'versioning_enabled' => true,
        'mfa_delete' => env('S3_MFA_DELETE', false),
        'backup_schedule' => 'daily',
    ],

    /*
    |--------------------------------------------------------------------------
    | Monitoring and Alerts
    |--------------------------------------------------------------------------
    */

    'monitoring' => [
        'enable_cloudwatch' => env('S3_CLOUDWATCH', false),
        'storage_alerts' => [
            'size_threshold_gb' => 100,
            'cost_threshold_usd' => 50,
        ],
        'access_alerts' => [
            'unusual_access_patterns' => true,
            'failed_access_attempts' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Compliance Settings
    |--------------------------------------------------------------------------
    */

    'compliance' => [
        'hipaa_compliance' => true,
        'gdpr_compliance' => true,
        'data_residency' => env('S3_DATA_RESIDENCY', null), // Specific region if required
        'retention_policies' => [
            'auto_delete_expired' => false, // Manual review required for medical records
            'legal_hold_support' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Development and Testing
    |--------------------------------------------------------------------------
    */

    'development' => [
        'use_local_in_dev' => env('S3_LOCAL_IN_DEV', true),
        'fake_uploads_in_testing' => true,
        'debug_mode' => env('S3_DEBUG', false),
        'log_all_operations' => env('S3_LOG_ALL_OPS', false),
    ],
];
