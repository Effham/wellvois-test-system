# AWS KMS Integration for Laravel CipherSweet

## Overview

This implementation wraps your CipherSweet encryption key with AWS KMS (Key Management Service) for enhanced security and compliance. This is called "envelope encryption" - your actual CipherSweet key remains the same, but it's encrypted/wrapped by AWS KMS.

### Benefits:
- **Enhanced Security**: Your encryption key is stored encrypted in AWS KMS
- **Automatic Rotation**: KMS can auto-rotate the wrapper key annually
- **Audit Trail**: AWS CloudTrail logs all key usage
- **Compliance**: Meets requirements for HIPAA, GDPR, and other regulations
- **No Data Re-encryption Needed**: Your CipherSweet key stays the same, only the wrapper rotates

---

## Requirements for DevOps Engineer

### 1. AWS KMS Key Setup

Ask your DevOps engineer to create a **symmetric KMS key** with the following specifications:

#### Key Configuration:
- **Key Type**: Symmetric
- **Key Usage**: Encrypt and decrypt
- **Key Spec**: SYMMETRIC_DEFAULT
- **Origin**: AWS_KMS
- **Regionality**: Single-Region key (or Multi-Region if you need it)

#### Key Policy Requirements:

The KMS key policy must allow your application to:
- `kms:Decrypt` - To unwrap the CipherSweet key at runtime
- `kms:Encrypt` - To wrap the key initially (can be removed after setup if desired)
- `kms:DescribeKey` - To verify key status

**Example Key Policy** (DevOps should customize this):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow application to use the key",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/YOUR-APP-ROLE"
      },
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:DescribeKey"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:Application": "YOUR-APP-NAME",
          "kms:EncryptionContext:Purpose": "CipherSweet-Encryption"
        }
      }
    }
  ]
}
```

#### Enable Automatic Key Rotation:
- ✅ **Enable automatic key rotation** (rotates annually)
- This rotates the AWS KMS key material, not your CipherSweet key
- Your application continues to work seamlessly during rotation

### 2. IAM Permissions for Application

Your application needs an IAM role (if running on EC2/ECS/Lambda) or IAM user with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT-ID:key/YOUR-KEY-ID"
    }
  ]
}
```

### 3. Information Needed from DevOps

After KMS key creation, you'll need:

1. **KMS Key ID or ARN**
   - Example Key ID: `1234abcd-12ab-34cd-56ef-1234567890ab`
   - Example Key ARN: `arn:aws:kms:us-east-1:123456789012:key/1234abcd-12ab-34cd-56ef-1234567890ab`
   - You can use either format

2. **AWS Region**
   - Example: `us-east-1`, `eu-west-1`, etc.

3. **IAM Credentials or Role**
   - If running on AWS (EC2/ECS/Lambda): IAM role ARN
   - If running outside AWS: Access Key ID and Secret Access Key

---

## Implementation Steps

### Step 1: Update Environment Variables

Add these to your `.env` file (don't commit these values to git):

```env
# AWS Credentials (if not using IAM role)
# AWS_ACCESS_KEY_ID=your-access-key-id
# AWS_SECRET_ACCESS_KEY=your-secret-access-key

# CipherSweet KMS Configuration
CIPHERSWEET_KMS_REGION=us-east-1
CIPHERSWEET_KMS_KEY_ID=your-kms-key-id-or-arn

# Keep your existing CIPHERSWEET_KEY for now (we'll wrap it next)
CIPHERSWEET_KEY=your-existing-ciphersweet-key
```

### Step 2: Wrap Your Existing CipherSweet Key

Run this command to encrypt your existing CipherSweet key with AWS KMS:

```bash
php artisan ciphersweet:wrap-key
```

The command will output a base64-encoded encrypted key. Copy this value.

**Alternative**: If you need to specify parameters manually:

```bash
php artisan ciphersweet:wrap-key \
  --plaintext-key="your-existing-ciphersweet-key" \
  --kms-key-id="your-kms-key-id" \
  --region="us-east-1"
```

### Step 3: Update .env with Encrypted Key

Add the encrypted key to your `.env`:

```env
# CipherSweet Configuration
CIPHERSWEET_PROVIDER=custom
CIPHERSWEET_KMS_ENCRYPTED_KEY="the-base64-encoded-encrypted-key-from-step-2"

# You can now remove or comment out the plaintext key
# CIPHERSWEET_KEY=your-old-plaintext-key
```

### Step 4: Test the Integration

Create a simple test to verify KMS integration works:

```bash
php artisan tinker
```

Then run:

```php
// Test that the key provider works
$provider = app(\ParagonIE\CipherSweet\Contract\KeyProviderInterface::class);
$key = $provider->getSymmetricKey();
echo "✓ KMS integration working!\n";
```

If no errors appear, the integration is working!

### Step 5: Verify Existing Data Still Works

Since we're using the same CipherSweet key (just wrapped), your existing encrypted data should work without re-encryption:

```bash
php artisan tinker
```

```php
// Test reading encrypted data
$history = \App\Models\Tenant\PatientMedicalHistory::first();
// If this works without errors, you're good to go!
```

---

## How It Works

### Envelope Encryption Flow

1. **At Application Startup:**
   - App reads `CIPHERSWEET_KMS_ENCRYPTED_KEY` from environment
   - Makes API call to AWS KMS to decrypt it
   - Receives the plaintext CipherSweet key
   - Caches it in memory for 5 minutes to reduce KMS API calls
   - Uses the decrypted key for all CipherSweet operations

2. **For Each Encryption/Decryption:**
   - CipherSweet uses the unwrapped key (from memory/cache)
   - No additional KMS calls needed
   - Same performance as before

3. **When KMS Key Rotates:**
   - AWS automatically rotates the KMS key material
   - Your encrypted CipherSweet key is automatically re-encrypted with new material
   - No action needed from you!
   - No data re-encryption required

### Key Rotation Strategy

**AWS KMS Key (Wrapper Key):**
- Automatically rotates annually if enabled
- Transparent to your application
- No downtime or data re-encryption needed

**CipherSweet Key (Data Encryption Key):**
- Remains the same (this is the key that encrypts your data)
- Only rotate if compromised (requires data re-encryption)
- Use `php artisan ciphersweet:encrypt` if rotation needed

---

## Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env` file to version control
- ✅ Use environment-specific `.env` files (`.env.production`, `.env.staging`)
- ✅ Rotate AWS credentials regularly

### 2. IAM Permissions
- ✅ Use IAM roles instead of access keys when possible
- ✅ Follow principle of least privilege
- ✅ Enable MFA for IAM users with KMS access

### 3. Monitoring
- ✅ Enable AWS CloudTrail for KMS key usage logging
- ✅ Set up CloudWatch alarms for:
  - Decrypt failures
  - Excessive decrypt calls
  - Unauthorized access attempts

### 4. Encryption Context
- ✅ Already implemented with:
  - `Application`: Your app name
  - `Purpose`: "CipherSweet-Encryption"
- This adds an additional security layer and audit trail

---

## Troubleshooting

### Error: "Failed to decrypt CipherSweet key with AWS KMS"

**Possible causes:**
1. IAM permissions not configured correctly
2. KMS key policy doesn't allow your role/user
3. Wrong AWS region specified
4. Network connectivity issues to AWS

**Solution:**
- Check IAM permissions
- Verify KMS key policy
- Check `CIPHERSWEET_KMS_REGION` matches key location
- Check AWS credentials are valid

### Error: "CIPHERSWEET_KMS_ENCRYPTED_KEY is not set"

**Solution:**
- Run `php artisan ciphersweet:wrap-key` to generate encrypted key
- Add it to `.env` as `CIPHERSWEET_KMS_ENCRYPTED_KEY`

### Error: "No plaintext key provided"

**Solution:**
- Make sure `CIPHERSWEET_KEY` is set in `.env` before running wrap-key command
- Or pass `--plaintext-key` option to the command

### Slow Performance

**Solution:**
- The implementation caches the decrypted key for 5 minutes
- Check your cache driver is configured correctly (`CACHE_DRIVER` in `.env`)
- Consider using Redis or Memcached for better performance

---

## Cost Considerations

### AWS KMS Pricing (as of 2024):
- **Customer Managed Keys**: $1/month per key
- **API Requests**: $0.03 per 10,000 requests

### Estimated Monthly Cost:
- Key: $1/month
- API Requests: ~$0.01-0.10/month (with caching)
- **Total**: ~$1-2/month

The caching strategy (5-minute cache) significantly reduces API calls.

---

## Migration Checklist

Use this checklist when implementing in production:

- [ ] DevOps creates KMS key with automatic rotation enabled
- [ ] KMS key policy allows application IAM role
- [ ] IAM role/user has correct permissions
- [ ] Add `CIPHERSWEET_KMS_REGION` to `.env`
- [ ] Add `CIPHERSWEET_KMS_KEY_ID` to `.env`
- [ ] Run `php artisan ciphersweet:wrap-key` in staging environment
- [ ] Add `CIPHERSWEET_KMS_ENCRYPTED_KEY` to `.env`
- [ ] Change `CIPHERSWEET_PROVIDER=custom` in `.env`
- [ ] Test in staging environment thoroughly
- [ ] Verify existing encrypted data can be read
- [ ] Deploy to production
- [ ] Monitor CloudWatch/CloudTrail for KMS usage
- [ ] Remove old `CIPHERSWEET_KEY` from `.env` (after confirming everything works)
- [ ] Document emergency recovery procedure

---

## Emergency Recovery

If you need to revert to the non-KMS setup:

1. **Restore the plaintext key:**
   ```env
   CIPHERSWEET_PROVIDER=string
   CIPHERSWEET_KEY=your-original-plaintext-key
   ```

2. **Clear application cache:**
   ```bash
   php artisan cache:clear
   php artisan config:clear
   ```

3. **Restart application**

Keep a secure backup of your original `CIPHERSWEET_KEY` until you're confident the KMS integration is stable.

---

## References

- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)
- [Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [Laravel CipherSweet Package](https://github.com/spatie/laravel-ciphersweet)
- [AWS SDK for PHP](https://docs.aws.amazon.com/sdk-for-php/)


