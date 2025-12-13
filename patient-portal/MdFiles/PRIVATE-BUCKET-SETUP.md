# Private S3 Bucket Setup Guide

This guide will help you set up a private S3 bucket for your EMR application with maximum security and HIPAA compliance.

## 🔒 Private Bucket Configuration

### 1. Update Your Environment File

Add these settings to your `.env` file:

```env
# S3 Private Bucket Configuration
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-private-emr-bucket

# Optional private bucket settings
AWS_URL=
AWS_ENDPOINT=
AWS_USE_PATH_STYLE_ENDPOINT=false
```

### 2. Your `config/filesystems.php` is Already Updated

The S3 disk configuration now includes private bucket settings:

```php
's3' => [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
    'throw' => false,
    'report' => false,
    // Private bucket specific settings
    'visibility' => 'private',
    'options' => [
        'ServerSideEncryption' => 'AES256',
        'StorageClass' => 'STANDARD',
    ],
],
```

## 🏗️ AWS S3 Bucket Setup

### Step 1: Create Your Private Bucket

```bash
# Using AWS CLI
aws s3 mb s3://your-private-emr-bucket --region us-east-1
```

### Step 2: Block All Public Access

```bash
# Block all public access
aws s3api put-public-access-block \
    --bucket your-private-emr-bucket \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 3: Enable Versioning

```bash
# Enable versioning for audit trails
aws s3api put-bucket-versioning \
    --bucket your-private-emr-bucket \
    --versioning-configuration Status=Enabled
```

### Step 4: Enable Server-Side Encryption

```bash
# Enable default encryption
aws s3api put-bucket-encryption \
    --bucket your-private-emr-bucket \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'
```

### Step 5: Create IAM Policy

Create an IAM policy for your application:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowPrivateBucketAccess",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetObjectVersion",
                "s3:DeleteObjectVersion"
            ],
            "Resource": [
                "arn:aws:s3:::your-private-emr-bucket",
                "arn:aws:s3:::your-private-emr-bucket/*"
            ]
        }
    ]
}
```

### Step 6: Create Bucket Policy (Optional - Extra Security)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DenyInsecureConnections",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::your-private-emr-bucket",
                "arn:aws:s3:::your-private-emr-bucket/*"
            ],
            "Condition": {
                "Bool": {
                    "aws:SecureTransport": "false"
                }
            }
        }
    ]
}
```

## ✅ Validation Commands

### Validate Your Setup

```bash
# Run the validation command
php artisan validate:s3-private-bucket

# Test the health check endpoint
curl https://your-app.com/health/s3

# Test private bucket validation
curl https://your-app.com/api/s3-examples/validate-private-bucket
```

## 🔧 Service Usage

### The Service Automatically Handles Private Buckets

```php
use App\Services\S3StorageService;

class YourController extends Controller
{
    protected S3StorageService $s3Service;

    public function uploadFile(Request $request)
    {
        // The service automatically detects private bucket
        // and applies appropriate security settings
        $result = $this->s3Service->uploadFile(
            $request->file('document'),
            'medical_documents',
            [
                'tenant_id' => tenant('id'),
                'entity_id' => $request->patient_id,
                // encrypt and visibility are automatically set for private buckets
            ]
        );

        if ($result['success']) {
            // File is automatically encrypted and stored privately
            return response()->json([
                'message' => 'File uploaded securely',
                'file_path' => $result['file_path'],
                // For private buckets, URLs are automatically signed
                'access_url' => $this->s3Service->getFileUrl($result['file_path'], 60)
            ]);
        }

        return response()->json(['error' => $result['error']], 400);
    }
}
```

### Private Bucket Features

1. **Automatic Encryption**: All files are encrypted with AES-256
2. **Signed URLs Only**: No direct public access - all URLs are temporary signed URLs
3. **Audit Logging**: All operations are logged for compliance
4. **Forced Private Visibility**: Cannot accidentally make files public

## 🛡️ Security Features

### What the Service Does Automatically for Private Buckets:

- ✅ Forces `visibility: 'private'` for all uploads
- ✅ Enables AES-256 encryption by default
- ✅ Returns signed URLs instead of direct URLs
- ✅ Logs all file operations for audit trails
- ✅ Validates bucket configuration on startup
- ✅ Provides health checks and diagnostics

### Medical File Example:

```php
// Upload medical document (automatically secure)
$result = $this->s3FileService->uploadEncounterDocument(
    $request->file('medical_record'),
    $encounterId,
    'lab_results',
    tenant('id')
);

// Get secure access URL (30-minute expiration for medical files)
$secureUrl = $this->s3FileService->getMedicalDocumentUrl(
    $result['file_path'],
    30 // 30 minutes expiration
);
```

## 📊 Monitoring & Validation

### Health Check Response (Private Bucket):

```json
{
    "status": "healthy",
    "message": "All S3 operations working correctly",
    "bucket_info": {
        "disk": "s3",
        "bucket": "your-private-emr-bucket",
        "region": "us-east-1",
        "is_private": true,
        "encryption_enabled": true,
        "encryption_type": "AES256"
    },
    "validation": {
        "valid": true,
        "is_private": true,
        "errors": [],
        "warnings": []
    },
    "url_test": {
        "signed_url_generated": true,
        "url_expires_in": "5 minutes"
    }
}
```

## 🚨 Troubleshooting

### Common Issues:

1. **Upload Fails with Access Denied**
   - Check IAM policy permissions
   - Verify bucket policy doesn't block your IP
   - Ensure AWS credentials are correct

2. **Files Not Encrypted**
   - Verify `ServerSideEncryption: AES256` in config
   - Check bucket default encryption settings

3. **Cannot Access Files**
   - Private bucket files require signed URLs
   - Use `getTemporaryUrl()` method for access
   - Check URL expiration time

### Debug Commands:

```bash
# Check configuration
php artisan validate:s3-private-bucket

# Test connectivity
curl https://your-app.com/health/s3

# View logs
tail -f storage/logs/laravel.log | grep S3
```

## 💰 Cost Optimization

### Private Bucket Cost Considerations:

- **Storage Classes**: Use Intelligent Tiering for automatic optimization
- **Lifecycle Policies**: Move old files to cheaper storage
- **Request Costs**: Signed URLs generate additional requests
- **Transfer Costs**: Consider Transfer Acceleration for global users

### Example Lifecycle Policy:

```json
{
    "Rules": [
        {
            "ID": "EMRDataLifecycle",
            "Status": "Enabled",
            "Filter": {"Prefix": "medical/"},
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 2555,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ]
        }
    ]
}
```

## 🏥 HIPAA Compliance Checklist

- ✅ Private bucket with blocked public access
- ✅ Server-side encryption (AES-256)
- ✅ Access logging enabled
- ✅ Versioning for audit trails
- ✅ Signed URLs with short expiration
- ✅ IAM policies with least privilege
- ✅ Secure transport (HTTPS) enforced
- ✅ Regular access reviews and monitoring

Your private bucket is now ready for secure medical data storage! 🎉

