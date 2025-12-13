# Developer Setup Guide - Field-Level Encryption

**For:** New developers setting up the project  
**Time Required:** 10-15 minutes  
**Difficulty:** Easy - Just configuration!

---

## Overview

This application uses **automatic field-level encryption** for sensitive patient medical data. Once you set up your environment, encryption happens **automatically** - you don't need to run any encryption commands!

### What Happens Automatically:
- ✅ Data is **encrypted when saved**
- ✅ Data is **decrypted when read**
- ✅ Blind indexes are **automatically created** for searching
- ✅ Encryption key is **unwrapped from AWS KMS** at runtime

### What You Need to Do:
- ✅ Install dependencies
- ✅ Configure environment variables
- ✅ That's it! 🎉

---

## Prerequisites

Before starting, ensure you have:
- ✅ PHP 8.2+
- ✅ Composer installed
- ✅ Access to `.env` file or environment variables
- ✅ AWS credentials (provided by DevOps)

---

## Step 1: Install Dependencies

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd emr-web

# Install PHP dependencies (includes Laravel CipherSweet)
composer install

# Install Node dependencies (for frontend)
npm install
```

**What this installs:**
- `spatie/laravel-ciphersweet` - Encryption package
- `aws/aws-sdk-php` - AWS SDK for KMS integration
- All other Laravel dependencies

---

## Step 2: Configure Environment Variables

### 2.1 Copy Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

### 2.2 Add AWS KMS Configuration

Add these lines to your `.env` file:

```env
# ============================================
# AWS KMS Configuration for Encryption
# ============================================

# AWS Region where KMS key is located
CIPHERSWEET_KMS_REGION=us-east-1

# AWS KMS Key ID (get from DevOps)
CIPHERSWEET_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/abc-123-def

# Encrypted CipherSweet key (get from DevOps)
CIPHERSWEET_KMS_ENCRYPTED_KEY=AQICAHhXXXXXXXXXXXXXXXXXXXX...

# CipherSweet provider (must be 'custom' for KMS)
CIPHERSWEET_PROVIDER=custom

# CipherSweet backend algorithm
CIPHERSWEET_BACKEND=nacl

# Allow empty encrypted fields
CIPHERSWEET_PERMIT_EMPTY=false
```

### 2.3 AWS Credentials (if not using IAM role)

If running **locally** (not on AWS), add:

```env
# AWS Credentials (only if not using IAM role)
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

**Note:** On production servers (EC2/ECS), IAM roles are used automatically - no credentials needed!

### 2.4 Database Configuration

Ensure database settings are correct:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=emr_central
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

---

## Step 3: Run Database Migrations

```bash
# Run central database migrations
php artisan migrate

# Run tenant database migrations
php artisan tenants:migrate
```

---

## Step 4: Test the Setup

### 4.1 Test KMS Connection

```bash
php artisan ciphersweet:test-kms
```

**Expected output:**
```
Testing AWS KMS CipherSweet Integration...

1. Checking configuration...
   Provider: custom
   Region: us-east-1
   Key ID: arn:aws:kms:...
   Encrypted Key: ✓ Set
   ✓ Configuration looks good

2. Testing KMS key decryption...
   ✓ Successfully decrypted key from AWS KMS

3. Testing CipherSweet encryption/decryption...
   ✓ Encryption/decryption working correctly

4. Testing cache...
   Cache driver: database
   
═══════════════════════════════════════
✓ All tests passed!
═══════════════════════════════════════
```

### 4.2 Test Encryption in Action

```bash
php artisan tinker
```

Then run this code:

```php
// Get a tenant
$tenant = \App\Models\Tenant::first();

// Run code in tenant context
$tenant->run(function() {
    // Create encrypted record
    $history = new \App\Models\Tenant\FamilyMedicalHistory([
        'patient_id' => 1,
        'summary' => 'Heart disease',
        'details' => 'Family history of cardiovascular issues',
        'relationship_to_patient' => 'Father',
        'diagnosis_date' => now(),
    ]);
    
    // Save - encryption happens automatically!
    $history->save();
    
    echo "✓ Saved! ID: {$history->id}\n";
    echo "✓ Summary (auto-decrypted): {$history->summary}\n";
    
    // Check database - should see encrypted data
    $raw = \DB::table('family_medical_histories')->find($history->id);
    echo "✓ Raw DB value: " . substr($raw->summary, 0, 50) . "...\n";
    echo "  (Should start with 'nacl:')\n";
});
```

**Expected output:**
```
✓ Saved! ID: 1
✓ Summary (auto-decrypted): Heart disease
✓ Raw DB value: nacl:aW5jb21lOnNhbHQ6Y3lwaDoyLjAuMDplbmNyeXB0ZW...
  (Should start with 'nacl:')
```

---

## Step 5: Start Developing!

You're all set! Encryption is now working automatically.

### Creating Encrypted Records

Just use normal Eloquent operations:

```php
use App\Models\Tenant\FamilyMedicalHistory;

// Create - encryption automatic
$history = FamilyMedicalHistory::create([
    'patient_id' => $patientId,
    'summary' => 'Diabetes',
    'details' => 'Type 2 diabetes diagnosed in 2020',
    'relationship_to_patient' => 'Mother',
]);

// Read - decryption automatic
$summary = $history->summary; // Returns "Diabetes" (decrypted)

// Update - re-encryption automatic
$history->update(['summary' => 'Type 2 Diabetes']);

// Search using blind indexes
$results = FamilyMedicalHistory::whereBlind('summary', 'summary_index', 'Diabetes')->get();
```

**No encryption commands needed!** Everything happens automatically! ✨

---

## Common Questions

### Q1: Do I need to run any encryption commands?

**A: NO!** Encryption happens automatically when you save records. You only need to:
- ✅ Install dependencies (`composer install`)
- ✅ Set environment variables
- ✅ Run migrations

### Q2: What if I pull new code with encrypted models?

**A:** Nothing changes! Just:
```bash
composer install  # Install any new dependencies
php artisan migrate  # Run any new migrations
```

Encryption still works automatically!

### Q3: Do I need to encrypt existing data?

**A:** Only if:
- You're setting up encryption for the **first time** on production with existing data
- You're **rotating the encryption key**

For new development environments, all new data is automatically encrypted when saved.

### Q4: What if the KMS test fails?

**Check:**
1. Is `CIPHERSWEET_KMS_ENCRYPTED_KEY` set correctly?
2. Is `CIPHERSWEET_KMS_KEY_ID` correct?
3. Are AWS credentials valid?
4. Can you reach AWS KMS? (network/firewall)

**Solution:** Contact DevOps for correct credentials.

### Q5: Can I develop without AWS KMS?

**A:** For local development, ask DevOps for:
- Development AWS credentials
- Development KMS key
- Wrapped development encryption key

**DO NOT** use production keys locally!

### Q6: What happens if AWS KMS is down?

**A:** Application cannot decrypt the encryption key, so:
- Cannot start new requests (that need decryption)
- Cached key (5 minutes) continues to work
- Non-encrypted data remains accessible

**This is rare** - AWS KMS has 99.999% uptime SLA.

---

## Which Models Are Encrypted?

Currently, these models have automatic encryption:

| Model | Location | Encrypted Fields |
|-------|----------|------------------|
| `FamilyMedicalHistory` | `app/Models/Tenant/` | `summary`, `details`, `relationship_to_patient` |

**Future models:** When new models are added with encryption, they work automatically - no developer action needed!

---

## How It Works (Behind the Scenes)

You don't need to know this for development, but if you're curious:

### 1. Application Starts
```
1. Reads CIPHERSWEET_KMS_ENCRYPTED_KEY from .env
2. Calls AWS KMS to decrypt it
3. Gets plaintext CipherSweet key
4. Caches it in memory (5 minutes)
```

### 2. You Save a Record
```php
$history->summary = "Heart disease";
$history->save();
```

```
Behind the scenes:
1. CipherSweet intercepts the save
2. Encrypts 'summary' field
3. Generates blind index hash
4. Saves encrypted data to database
5. Saves blind index for searching
```

### 3. You Read a Record
```php
$summary = $history->summary;
```

```
Behind the scenes:
1. Database returns encrypted value: "nacl:aW5jb21l..."
2. CipherSweet intercepts the read
3. Decrypts the value
4. Returns plaintext: "Heart disease"
```

### 4. You Search a Record
```php
$results = FamilyMedicalHistory::whereBlind('summary', 'summary_index', 'Heart disease')->get();
```

```
Behind the scenes:
1. CipherSweet generates blind index for "Heart disease"
2. Queries blind_indexes table for matching hash
3. Returns matching records
4. Auto-decrypts results
```

**All automatic!** You just use normal Eloquent! ✨

---

## Troubleshooting

### Error: "Failed to decrypt CipherSweet key with AWS KMS"

**Causes:**
- Wrong `CIPHERSWEET_KMS_ENCRYPTED_KEY`
- Wrong `CIPHERSWEET_KMS_KEY_ID`
- Invalid AWS credentials
- No network access to AWS

**Solution:**
```bash
# Verify configuration
php artisan config:clear
php artisan ciphersweet:test-kms

# Check AWS credentials
aws sts get-caller-identity

# Check KMS access
aws kms describe-key --key-id your-key-id
```

### Error: "This cache store does not support tagging"

**Solution:** Already fixed in `config/tenancy.php`:
```php
'bootstrappers' => [
    Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
    // CacheTenancyBootstrapper is disabled (causes tagging issues)
    Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper::class,
    Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper::class,
],
```

No action needed - it's already configured!

### Error: "Target [ParagonIE\CipherSweet\Contract\KeyProviderInterface] is not instantiable"

**Solution:** Already fixed in `app/Providers/AppServiceProvider.php`

If you see this, run:
```bash
php artisan config:clear
php artisan cache:clear
```

---

## Development Best Practices

### ✅ DO:
- Use normal Eloquent operations
- Trust automatic encryption/decryption
- Use `whereBlind()` for searching encrypted fields
- Keep AWS credentials secure (never commit to git)
- Test with `php artisan ciphersweet:test-kms` after setup

### ❌ DON'T:
- Don't try to manually encrypt/decrypt fields
- Don't use raw SQL queries on encrypted fields
- Don't commit `.env` file to git
- Don't use production KMS keys locally
- Don't disable encryption without discussing with team

---

## Need Help?

### Documentation:
- `COMPLIANCE_ENCRYPTION_DOCUMENTATION.md` - Full compliance details
- `AWS_KMS_KEY_ROTATION_EXPLAINED.md` - How key rotation works
- `KMS_TROUBLESHOOTING.md` - Troubleshooting guide

### Commands:
```bash
# Test KMS integration
php artisan ciphersweet:test-kms

# List all Artisan commands
php artisan list ciphersweet
php artisan list tenants
```

### Contacts:
- **DevOps:** For AWS credentials and KMS key
- **Security Team:** For encryption questions
- **Lead Developer:** For implementation questions

---

## Summary: Your 5-Minute Setup

```bash
# 1. Install dependencies
composer install

# 2. Configure .env (get values from DevOps)
CIPHERSWEET_PROVIDER=custom
CIPHERSWEET_KMS_REGION=us-east-1
CIPHERSWEET_KMS_KEY_ID=<from-devops>
CIPHERSWEET_KMS_ENCRYPTED_KEY=<from-devops>

# 3. Run migrations
php artisan migrate
php artisan tenants:migrate

# 4. Test it works
php artisan ciphersweet:test-kms

# 5. Start coding! 🚀
```

**That's it!** Encryption works automatically from now on! ✨

---

## What's Next?

Now that encryption is set up:

1. **Start developing** - Use normal Eloquent operations
2. **Run tests** - Encryption works in tests too
3. **Deploy** - Same setup works in staging/production
4. **Monitor** - CloudTrail logs all KMS usage

**No encryption commands needed!** Everything is automatic! 🎉

