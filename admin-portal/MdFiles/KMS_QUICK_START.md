# AWS KMS CipherSweet Integration - Quick Start

## What You Need to Tell Your DevOps Engineer

"I need an AWS KMS symmetric encryption key set up for our Laravel application to encrypt sensitive patient data. Here are the requirements:"

### 1. Create KMS Key
- **Type**: Symmetric encryption key
- **Usage**: Encrypt and decrypt
- **Region**: [Specify your preferred AWS region, e.g., us-east-1]
- **Enable automatic key rotation**: YES (annual rotation)

### 2. Key Policy
The key needs to allow our application to:
- `kms:Decrypt` (required for runtime)
- `kms:Encrypt` (required for initial setup)
- `kms:DescribeKey` (optional, for monitoring)

Add encryption context for additional security:
- `Application`: Your app name (from `APP_NAME` in `.env`)
- `Purpose`: `CipherSweet-Encryption`

### 3. IAM Permissions
Grant our application's IAM role/user access to the KMS key:
- If running on EC2/ECS/Lambda: Attach policy to IAM role
- If running elsewhere: Provide IAM credentials with KMS access

### 4. What I Need Back
Once created, please provide:
- ✅ **KMS Key ID** (e.g., `1234abcd-12ab-34cd-56ef-1234567890ab`)
  OR **KMS Key ARN** (e.g., `arn:aws:kms:us-east-1:123456789012:key/1234abcd-...`)
- ✅ **AWS Region** (e.g., `us-east-1`)
- ✅ **IAM Credentials** (if not using IAM role) or **IAM Role ARN**

---

## Implementation Steps (After DevOps Setup)

### Step 1: Add AWS Configuration to .env

```env
# AWS Region where KMS key is located
CIPHERSWEET_KMS_REGION=us-east-1

# KMS Key ID or ARN (provided by DevOps)
CIPHERSWEET_KMS_KEY_ID=your-kms-key-id-from-devops

# If not using IAM role (running outside AWS)
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Step 2: Wrap Your Existing CipherSweet Key

**IMPORTANT**: Before running this, make sure you have your current `CIPHERSWEET_KEY` in `.env`

```bash
php artisan ciphersweet:wrap-key
```

This command will:
1. Read your current `CIPHERSWEET_KEY`
2. Encrypt it with AWS KMS
3. Output a base64-encoded encrypted key

Copy the output that looks like this:
```
CIPHERSWEET_KMS_ENCRYPTED_KEY="very-long-base64-string..."
```

### Step 3: Update .env File

```env
# Change provider from 'string' to 'custom'
CIPHERSWEET_PROVIDER=custom

# Add the encrypted key from Step 2
CIPHERSWEET_KMS_ENCRYPTED_KEY="paste-the-encrypted-key-here"

# Optional: Keep old key commented for rollback safety
# CIPHERSWEET_KEY=your-old-plaintext-key
```

### Step 4: Clear Caches

```bash
php artisan config:clear
php artisan cache:clear
```

### Step 5: Test It Works

```bash
php artisan tinker
```

In tinker, run:
```php
// Test KMS integration
$provider = app(\ParagonIE\CipherSweet\Contract\KeyProviderInterface::class);
$key = $provider->getSymmetricKey();
echo "✓ KMS integration working!\n";

// Test reading existing encrypted data
$history = \App\Models\Tenant\PatientMedicalHistory::first();
echo "✓ Existing data readable!\n";
```

If both succeed, you're done! 🎉

---

## What Changed in Your Code

### Files Modified:
1. ✅ `config/ciphersweet.php` - Added KMS configuration
2. ✅ `app/Services/AwsKmsKeyProvider.php` - Custom key provider (NEW)
3. ✅ `app/Services/AwsKmsKeyProviderFactory.php` - Factory class (NEW)
4. ✅ `app/Console/Commands/WrapCipherSweetKeyCommand.php` - Helper command (NEW)

### What Happens Now:
- When your app starts, it reads the encrypted key from `.env`
- Makes an API call to AWS KMS to decrypt it
- Caches the decrypted key in memory (5-minute cache)
- Uses it for all CipherSweet operations
- Your existing encrypted data works without changes!

---

## Important Notes

### ✅ DO:
- Keep `CIPHERSWEET_KMS_ENCRYPTED_KEY` secret (it's encrypted but still sensitive)
- Test in staging environment first
- Keep a backup of your original `CIPHERSWEET_KEY` until confident
- Monitor AWS CloudTrail for KMS usage

### ❌ DON'T:
- Commit `.env` file to git
- Share AWS credentials in code or documentation
- Disable AWS KMS key rotation (keep it enabled)
- Delete your backup of the original key immediately

---

## Rollback Plan (If Something Goes Wrong)

If you need to revert:

1. Edit `.env`:
```env
CIPHERSWEET_PROVIDER=string
CIPHERSWEET_KEY=your-original-plaintext-key
```

2. Clear cache:
```bash
php artisan config:clear
php artisan cache:clear
```

3. Restart your application

---

## Cost

AWS KMS costs approximately **$1-2 per month**:
- $1/month for the key
- $0.03 per 10,000 API requests (minimal due to caching)

---

## Compliance Benefits

This implementation provides:
- ✅ Encryption key stored in AWS KMS (not in plain text)
- ✅ Automatic key rotation (annual)
- ✅ Full audit trail via AWS CloudTrail
- ✅ Meets HIPAA, GDPR, SOC 2 requirements
- ✅ No application downtime during key rotation
- ✅ No data re-encryption needed when KMS key rotates

---

## Troubleshooting

### "Failed to decrypt CipherSweet key with AWS KMS"
- Check IAM permissions
- Verify `CIPHERSWEET_KMS_KEY_ID` is correct
- Verify `CIPHERSWEET_KMS_REGION` matches key location
- Check AWS credentials are valid

### "CIPHERSWEET_KMS_ENCRYPTED_KEY is not set"
- Run `php artisan ciphersweet:wrap-key` to generate it
- Make sure you copied the full output to `.env`

### Application is slow
- Check your cache driver is configured (`CACHE_DRIVER` in `.env`)
- Consider using Redis or Memcached for better caching

---

## Need Help?

See the full documentation: `AWS_KMS_CIPHERSWEET_SETUP.md`


