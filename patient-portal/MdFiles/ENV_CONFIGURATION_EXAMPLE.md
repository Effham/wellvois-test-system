# Environment Configuration Example

## AWS KMS CipherSweet Configuration

Add these variables to your `.env` file:

```bash
# =========================================
# AWS KMS Configuration for CipherSweet
# =========================================

# AWS Credentials (only if NOT using IAM role)
# If running on EC2/ECS/Lambda, these are not needed (use IAM role instead)
# AWS_ACCESS_KEY_ID=your-access-key-id
# AWS_SECRET_ACCESS_KEY=your-secret-access-key

# AWS Region where your KMS key is located
CIPHERSWEET_KMS_REGION=us-east-1

# KMS Key ID or ARN (provided by DevOps engineer)
# Can be Key ID: 1234abcd-12ab-34cd-56ef-1234567890ab
# Or Key ARN: arn:aws:kms:us-east-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab
CIPHERSWEET_KMS_KEY_ID=your-kms-key-id-or-arn

# KMS API version (usually leave as 'latest')
CIPHERSWEET_KMS_VERSION=latest

# =========================================
# After Running: php artisan ciphersweet:wrap-key
# =========================================

# Switch to custom provider
CIPHERSWEET_PROVIDER=custom

# Add the encrypted key (output from wrap-key command)
CIPHERSWEET_KMS_ENCRYPTED_KEY=base64-encoded-encrypted-key-here

# Optional: Keep old key for rollback (comment it out)
# CIPHERSWEET_KEY=your-old-plaintext-key

# =========================================
# Other CipherSweet Settings (unchanged)
# =========================================
CIPHERSWEET_BACKEND=nacl
CIPHERSWEET_PERMIT_EMPTY=false
```

## Migration Steps

### Before KMS (Current State)
```bash
CIPHERSWEET_PROVIDER=string
CIPHERSWEET_KEY=your-plaintext-ciphersweet-key
```

### After KMS Setup
```bash
CIPHERSWEET_PROVIDER=custom
CIPHERSWEET_KMS_REGION=us-east-1
CIPHERSWEET_KMS_KEY_ID=your-kms-key-id
CIPHERSWEET_KMS_ENCRYPTED_KEY=encrypted-key-from-wrap-command
# CIPHERSWEET_KEY=commented-out-for-rollback
```


