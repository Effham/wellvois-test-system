# KMS CipherSweet Troubleshooting Guide

## Issue: "Target [ParagonIE\CipherSweet\Contract\KeyProviderInterface] is not instantiable"

### Problem
Laravel's service container doesn't know how to create the custom KeyProvider instance.

### Solution ✅
Added service container binding in `AppServiceProvider.php`:

```php
public function register(): void
{
    // Register CipherSweet KeyProvider binding
    if (config('ciphersweet.provider') === 'custom') {
        $this->app->singleton(
            \ParagonIE\CipherSweet\Contract\KeyProviderInterface::class,
            function ($app) {
                $factory = config('ciphersweet.providers.custom');
                return $app->make($factory)();
            }
        );
    }
}
```

### Steps to Fix
1. The fix has been applied to `app/Providers/AppServiceProvider.php`
2. Clear config cache: `php artisan config:clear`
3. Try the test again: `php artisan ciphersweet:test-kms`

---

## Issue: "Incorrect string value" when caching (MySQL)

### Problem
```
SQLSTATE[HY000]: General error: 1366 Incorrect string value: '\x816\xB8\xDC\x9F\xF2...' 
for column 'value' at row 1
```

This occurs when using MySQL/MariaDB as the cache driver because the decrypted key contains binary data that MySQL's `utf8mb4` charset cannot store.

### Solution ✅
The fix stores the key as base64 in the cache instead of raw binary data. This has been implemented in `AwsKmsKeyProvider.php`.

**Steps:**
1. Clear the cache: `php artisan cache:clear`
2. Test again: `php artisan ciphersweet:test-kms`

**Alternative:** Use a better cache driver:
```bash
# In .env
CACHE_DRIVER=redis  # or memcached, or file
```

Redis and Memcached handle binary data better than database cache.

---

## Other Common Issues

### Issue: "Failed to decrypt CipherSweet key with AWS KMS"

Even with correct IAM permissions, this can happen due to:

#### 1. Encryption Context Mismatch
The encryption context must match when encrypting and decrypting.

**Check your APP_NAME:**
```bash
# In .env
APP_NAME="Your App Name"
```

The encryption context uses:
- `Application`: Value from `config('app.name')`
- `Purpose`: `CipherSweet-Encryption`

**If APP_NAME changed after wrapping the key, you'll get decrypt errors!**

**Solution:**
```bash
# Re-wrap the key with the correct APP_NAME
php artisan ciphersweet:wrap-key
```

#### 2. Wrong KMS Key Region
```bash
# Make sure these match
CIPHERSWEET_KMS_REGION=us-east-1  # Where your KMS key actually is
```

#### 3. AWS Credentials Not Available
```bash
# Check credentials are loaded
php artisan tinker
>>> config('aws.credentials.key')
>>> config('aws.credentials.secret')
```

Or if using IAM role:
```bash
# Check instance profile
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

#### 4. KMS Key Policy Restrictions
The KMS key policy might require encryption context. Check with DevOps:

```json
{
  "Condition": {
    "StringEquals": {
      "kms:EncryptionContext:Application": "YourAppName",
      "kms:EncryptionContext:Purpose": "CipherSweet-Encryption"
    }
  }
}
```

---

### Issue: "CIPHERSWEET_KMS_ENCRYPTED_KEY is not set"

**Solution:**
```bash
php artisan ciphersweet:wrap-key
# Copy the output to .env
```

---

### Issue: Slow Performance

**Symptoms:**
- Every request is slow
- Lots of KMS API calls in CloudTrail

**Cause:**
Cache not working properly

**Solution:**
1. Check cache driver:
```bash
# In .env
CACHE_DRIVER=redis  # or memcached
```

2. Clear cache:
```bash
php artisan cache:clear
```

3. Verify cache is working:
```bash
php artisan tinker
>>> Cache::put('test', 'value', 60);
>>> Cache::get('test');  // Should return 'value'
```

---

### Issue: "InvalidCiphertextException"

**Cause:**
The encrypted key was corrupted or is from a different KMS key.

**Solution:**
Re-wrap the key:
```bash
php artisan ciphersweet:wrap-key
# Update CIPHERSWEET_KMS_ENCRYPTED_KEY in .env
```

---

### Issue: Works in Tinker but not in Web Requests

**Cause:**
Tinker might be using different environment or cache.

**Solution:**
1. Clear all caches:
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

2. Restart web server/PHP-FPM:
```bash
# For Laravel Sail
sail restart

# For Nginx/PHP-FPM
sudo systemctl restart php8.2-fpm
sudo systemctl restart nginx
```

---

## Debug Commands

### Test KMS Connection
```bash
php artisan tinker
```

```php
// Test AWS SDK
$kms = new \Aws\Kms\KmsClient([
    'region' => config('ciphersweet.kms.region'),
    'version' => 'latest',
]);

// List keys (requires kms:ListKeys permission)
$result = $kms->listKeys();
print_r($result['Keys']);

// Describe your key
$result = $kms->describeKey([
    'KeyId' => config('ciphersweet.kms.key_id'),
]);
print_r($result['KeyMetadata']);
```

### Test Decryption Manually
```bash
php artisan tinker
```

```php
use App\Services\AwsKmsKeyProvider;

$provider = new AwsKmsKeyProvider();
try {
    $key = $provider->getSymmetricKey();
    echo "✓ Decryption successful!\n";
} catch (\Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}
```

### Check Configuration
```bash
php artisan tinker
```

```php
// Check all CipherSweet config
config('ciphersweet');

// Check specific values
config('ciphersweet.provider');  // Should be 'custom'
config('ciphersweet.kms.region');
config('ciphersweet.kms.key_id');
strlen(config('ciphersweet.kms.encrypted_key'));  // Should be > 0
```

---

## CloudWatch/CloudTrail Monitoring

### Check KMS API Calls
1. Go to AWS CloudTrail console
2. Filter by:
   - Event name: `Decrypt`
   - Resource: Your KMS key ARN
3. Look for errors in response

### Common CloudTrail Errors

#### "AccessDeniedException"
IAM permissions issue. Grant `kms:Decrypt` to your role.

#### "IncorrectKeyException"
Wrong KMS key ID specified.

#### "InvalidCiphertextException"
Encrypted key is corrupted or from different key.

---

## Emergency Rollback

If KMS integration is causing issues, rollback immediately:

```bash
# 1. Edit .env
CIPHERSWEET_PROVIDER=string
CIPHERSWEET_KEY=your-original-plaintext-key

# 2. Clear cache
php artisan config:clear
php artisan cache:clear

# 3. Restart application
# (method depends on your setup)
```

Your application will immediately start using the plaintext key again.

---

## Verification Checklist

After fixing any issue, verify:

- [ ] `php artisan config:clear` (always clear cache first)
- [ ] `php artisan ciphersweet:test-kms` passes all tests
- [ ] Can read existing encrypted data in database
- [ ] Can create new encrypted records
- [ ] No errors in application logs
- [ ] No AccessDenied errors in CloudTrail
- [ ] Performance is normal (check response times)

---

## Getting Help

### Information to Provide

When asking for help, provide:

1. **Error message** (exact text)
2. **Configuration** (sanitized):
```bash
php artisan tinker
>>> config('ciphersweet.provider')
>>> config('ciphersweet.kms.region')
>>> config('ciphersweet.kms.key_id')
>>> strlen(config('ciphersweet.kms.encrypted_key'))
```

3. **IAM Policy** (sanitized)
4. **KMS Key Policy** (sanitized)
5. **CloudTrail logs** (recent decrypt attempts)
6. **Application logs** (error stack trace)

### DO NOT Share
- ❌ AWS Access Keys
- ❌ AWS Secret Keys
- ❌ KMS Key ARN (sanitize it)
- ❌ Encrypted CipherSweet key
- ❌ Account IDs

---

## Prevention

### Before Deploying to Production

1. **Test thoroughly in staging**
   - Use same KMS setup as production
   - Test all encrypted models
   - Verify performance

2. **Document everything**
   - KMS key ID
   - IAM role/user
   - Emergency contacts

3. **Set up monitoring**
   - CloudWatch alarm for KMS decrypt failures
   - Application error alerts
   - Performance monitoring

4. **Have rollback plan ready**
   - Keep original `CIPHERSWEET_KEY` in secure location
   - Document rollback steps
   - Test rollback procedure

5. **Train team**
   - Ensure team knows how KMS integration works
   - Share troubleshooting guide
   - Document who to contact for KMS issues

---

## Success Indicators

You'll know it's working when:

- ✅ `php artisan ciphersweet:test-kms` passes all tests
- ✅ Application starts without errors
- ✅ Can read existing encrypted data
- ✅ Can create new encrypted records
- ✅ No performance degradation
- ✅ CloudTrail shows successful Decrypt operations
- ✅ No errors in application logs
- ✅ Cache is working (only ~1 KMS call per 5 minutes)

