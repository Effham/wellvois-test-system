# S3 Storage Service for EMR Application

A comprehensive S3 storage solution designed specifically for Electronic Medical Records (EMR) applications with HIPAA compliance, security, and multi-tenant support.

## 📋 Features

- **🔒 HIPAA Compliant**: Server-side encryption, access logging, audit trails
- **🏢 Multi-tenant Support**: Isolated file storage per tenant
- **📁 File Type Management**: Specialized handlers for different file categories
- **🛡️ Security First**: Encryption, signed URLs, access controls
- **📊 Monitoring**: Storage statistics, health checks, error tracking
- **🔄 Backup Ready**: Cross-region replication support
- **⚡ Performance**: Multipart uploads, transfer acceleration

## 🚀 Quick Start

### 1. Installation

```bash
# Install the service provider
php artisan vendor:publish --tag=s3-storage-config

# Add to config/app.php providers array:
App\Providers\S3StorageServiceProvider::class,
```

### 2. Environment Configuration

Copy the S3 configuration to your `.env` file:

```bash
cp .env.s3.example .env.s3
# Edit .env.s3 with your AWS credentials and copy to .env
```

Required environment variables:
```env
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-bucket-name
```

### 3. AWS S3 Setup

Create an S3 bucket with the following settings:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT:user/YOUR_USER"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

## 💻 Usage Examples

### Basic File Upload

```php
use App\Services\S3StorageService;

class YourController extends Controller
{
    protected S3StorageService $s3Service;

    public function __construct(S3StorageService $s3Service)
    {
        $this->s3Service = $s3Service;
    }

    public function uploadFile(Request $request)
    {
        $result = $this->s3Service->uploadFile(
            $request->file('document'),
            'medical_documents',
            [
                'tenant_id' => tenant('id'),
                'entity_id' => $request->patient_id,
                'encrypt' => true,
                'visibility' => 'private'
            ]
        );

        if ($result['success']) {
            // Save file path to database
            Document::create([
                'file_path' => $result['file_path'],
                'original_name' => $result['original_name'],
                'file_size' => $result['file_size'],
            ]);
        }

        return response()->json($result);
    }
}
```

### Specialized File Type Services

```php
use App\Services\S3FileTypeService;

class PractitionerController extends Controller
{
    protected S3FileTypeService $s3FileService;

    public function __construct(S3FileTypeService $s3FileService)
    {
        $this->s3FileService = $s3FileService;
    }

    // Upload practitioner profile picture
    public function uploadProfile(Request $request)
    {
        $result = $this->s3FileService->uploadPractitionerProfilePicture(
            $request->file('profile_picture'),
            $request->practitioner_id,
            tenant('id')
        );

        return response()->json($result);
    }

    // Upload multiple practitioner documents
    public function uploadDocuments(Request $request)
    {
        $result = $this->s3FileService->uploadPractitionerDocuments(
            $request->file('documents'),
            $request->practitioner_id,
            'licensing_docs',
            tenant('id')
        );

        return response()->json($result);
    }
}
```

### Medical Document Upload (HIPAA Compliant)

```php
public function uploadMedicalDocument(Request $request)
{
    // Upload with maximum security
    $result = $this->s3FileService->uploadEncounterDocument(
        $request->file('medical_document'),
        $request->encounter_id,
        $request->document_type,
        tenant('id')
    );

    if ($result['success']) {
        // Create audit log
        AuditLog::create([
            'action' => 'medical_document_uploaded',
            'file_path' => $result['file_path'],
            'user_id' => auth()->id(),
            'tenant_id' => tenant('id'),
        ]);
    }

    return response()->json($result);
}
```

### Secure File Access

```php
public function downloadMedicalDocument($documentId)
{
    $document = EncounterDocument::findOrFail($documentId);
    
    // Verify user has permission to access this document
    if (!$this->userCanAccessDocument(auth()->user(), $document)) {
        abort(403);
    }

    // Generate temporary signed URL (expires in 30 minutes)
    $url = $this->s3FileService->getMedicalDocumentUrl(
        $document->file_path,
        30
    );

    if ($url) {
        return redirect($url);
    }

    abort(404, 'File not found');
}
```

## 🔧 File Categories

The service supports different file categories with specific security settings:

### Medical Documents
- **Encryption**: ✅ Required (AES-256)
- **Visibility**: Private
- **Retention**: 7 years
- **Backup**: ✅ Enabled
- **Audit**: ✅ All access logged

### Practitioner Documents
- **Encryption**: ✅ Required
- **Visibility**: Private
- **Retention**: 5 years
- **Backup**: ✅ Enabled
- **Audit**: ✅ All access logged

### Patient Files
- **Encryption**: ✅ Required
- **Visibility**: Private
- **Retention**: 7 years
- **Backup**: ✅ Enabled
- **Audit**: ✅ All access logged

### Organization Assets
- **Encryption**: ❌ Optional
- **Visibility**: Public
- **Retention**: 1 year
- **Backup**: ❌ Not required
- **Audit**: ❌ Not required

## 🛡️ Security Features

### Encryption
- Server-side encryption (AES-256) for all sensitive files
- Automatic encryption for medical documents
- Optional KMS encryption for additional security

### Access Control
- Temporary signed URLs with configurable expiration
- IP-based restrictions (optional)
- Role-based access control integration

### Audit Logging
- All file operations logged
- User activity tracking
- Compliance reporting ready

## 📊 File Organization

Files are automatically organized using this structure:

```
bucket/
├── uploads/
│   ├── medical_documents/
│   │   └── tenant_123/
│   │       └── entity_456/
│   │           └── 2024/01/
│   │               └── randomfilename.pdf
│   ├── practitioner/
│   │   ├── profile_pictures/
│   │   └── documents/
│   └── patients/
│       └── coverage_cards/
└── medical/
    ├── encounters/
    └── reports/
```

## ⚙️ Configuration

### File Type Restrictions

```php
// config/s3-storage.php
'file_types' => [
    'medical_files' => [
        'extensions' => ['pdf', 'dcm', 'jpg', 'jpeg', 'png'],
        'mime_types' => [
            'application/pdf',
            'application/dicom',
            'image/jpeg',
            'image/png'
        ],
        'max_size' => 51200, // 50MB
    ],
],
```

### Security Settings

```php
'security' => [
    'default_encryption' => 'AES256',
    'require_encryption_for_medical' => true,
    'access_logging' => true,
    'ip_restrictions' => false,
],
```

## 🔍 Monitoring & Health Checks

### Health Check Endpoint

```php
Route::get('/health/s3', [S3StorageExampleController::class, 'healthCheck']);
```

### Storage Statistics

```php
$stats = $this->s3Service->getStorageStats('medical_documents/');
// Returns: ['file_count' => 1250, 'total_size' => 5368709120, 'total_size_formatted' => '5.00 GB']
```

## 🚨 Error Handling

The service includes comprehensive error handling:

```php
$result = $this->s3Service->uploadFile($file, $category, $options);

if (!$result['success']) {
    Log::error('File upload failed', [
        'error' => $result['error'],
        'file' => $file->getClientOriginalName(),
        'category' => $category,
    ]);
    
    return response()->json([
        'message' => 'Upload failed',
        'error' => $result['error']
    ], 400);
}
```

## 📋 Migration from Local Storage

### Step 1: Update Controllers

Replace direct file operations:

```php
// Before (local storage)
$file->move($directory, $filename);

// After (S3 storage)
$result = $this->s3Service->uploadFile($file, $category, $options);
```

### Step 2: Update File URLs

Replace direct file URLs:

```php
// Before
$url = asset('storage/' . $document->file_path);

// After
$url = $this->s3Service->getTemporaryUrl($document->file_path, 60);
```

### Step 3: Migrate Existing Files

```bash
# Create migration command
php artisan make:command MigrateFilesToS3

# Run migration
php artisan migrate:files-to-s3 --category=medical_documents
```

## 🔄 Backup & Disaster Recovery

### Cross-Region Replication

Enable in `.env`:
```env
S3_CROSS_REGION_BACKUP=true
S3_BACKUP_REGION=us-west-2
```

### Versioning

Automatic versioning is enabled for all sensitive files to maintain audit trails and allow recovery from accidental deletions.

## 📈 Performance Optimization

### Multipart Uploads
- Automatic for files > 8MB
- Improved upload reliability
- Better progress tracking

### Transfer Acceleration
- Enable for global users
- Reduces upload times by up to 50%

### Intelligent Tiering
- Automatic cost optimization
- Moves infrequently accessed files to cheaper storage

## 🧪 Testing

### Unit Tests

```php
// Test file upload
$response = $this->postJson('/api/upload', [
    'file' => UploadedFile::fake()->create('test.pdf', 1000),
    'category' => 'medical_documents',
]);

$response->assertStatus(200)
         ->assertJsonStructure(['file_path', 'file_size']);
```

### Health Checks

```bash
# Test S3 connectivity
curl https://your-app.com/health/s3
```

## 📞 Support & Troubleshooting

### Common Issues

1. **Upload Fails**: Check AWS credentials and bucket permissions
2. **Access Denied**: Verify IAM policies and bucket CORS settings
3. **File Not Found**: Ensure file path is correct and file exists

### Debug Mode

Enable debug logging:
```env
S3_DEBUG=true
S3_LOG_ALL_OPS=true
```

### Logs

Monitor these log files:
- `storage/logs/laravel.log` - General application logs
- AWS CloudTrail - S3 access logs (if enabled)

## 📄 License

This S3 Storage Service is part of the EMR application and follows the same licensing terms.

