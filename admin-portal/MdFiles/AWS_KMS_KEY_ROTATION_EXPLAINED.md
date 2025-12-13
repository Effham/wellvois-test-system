# AWS KMS Key Rotation - How It Really Works

## Your Concern (Valid Question!)

You're worried that when AWS KMS rotates the key, you'll need to manually update `CIPHERSWEET_KMS_ENCRYPTED_KEY` in your `.env` file. Let me explain why you **DON'T** need to do that!

---

## Understanding the Two Keys

### 1. **AWS KMS Key** (The Wrapper Key)
- Lives in AWS KMS service
- Used to encrypt/decrypt your CipherSweet key
- **Rotates automatically** (when enabled)

### 2. **CipherSweet Key** (Your Data Encryption Key)
- The actual 32-byte key that encrypts your data
- Stored in `.env` as `CIPHERSWEET_KMS_ENCRYPTED_KEY` (encrypted by KMS)
- **Does NOT rotate** (stays the same)

---

## How AWS KMS Automatic Rotation Actually Works

### ❌ What You Might Think Happens:
```
1. AWS rotates KMS key
2. Your encrypted CipherSweet key becomes invalid
3. You need to manually re-wrap your key
4. Update CIPHERSWEET_KMS_ENCRYPTED_KEY in .env
```

### ✅ What ACTUALLY Happens (AWS Magic!):
```
1. AWS rotates KMS key (creates new key material)
2. AWS keeps ALL old key versions internally
3. When you decrypt, AWS automatically uses the correct version
4. Your CIPHERSWEET_KMS_ENCRYPTED_KEY stays valid forever!
5. No manual updates needed!
```

---

## The AWS KMS Key Versioning System

When you enable automatic rotation, here's what AWS does:

### Before Rotation:
```
AWS KMS Key: arn:aws:kms:us-east-1:123456789012:key/abc-123
├── Key Version 1 (ACTIVE) ← Currently encrypting
└── Encrypted Data:
    └── CIPHERSWEET_KMS_ENCRYPTED_KEY (encrypted with Version 1)
```

### After 1 Year (Automatic Rotation):
```
AWS KMS Key: arn:aws:kms:us-east-1:123456789012:key/abc-123 (same ARN!)
├── Key Version 1 (OLD but still usable) ← Can still decrypt old data
├── Key Version 2 (ACTIVE) ← New encryptions use this
└── Encrypted Data:
    └── CIPHERSWEET_KMS_ENCRYPTED_KEY (still encrypted with Version 1)
        ✓ AWS automatically uses Version 1 to decrypt this!
```

### After 2 Years:
```
AWS KMS Key: arn:aws:kms:us-east-1:123456789012:key/abc-123 (still same ARN!)
├── Key Version 1 (OLD) ← Can still decrypt
├── Key Version 2 (OLD) ← Can still decrypt
├── Key Version 3 (ACTIVE) ← New encryptions use this
└── Encrypted Data:
    └── CIPHERSWEET_KMS_ENCRYPTED_KEY (STILL encrypted with Version 1)
        ✓ AWS automatically uses Version 1 to decrypt this!
```

**Key Point:** Your `CIPHERSWEET_KMS_ENCRYPTED_KEY` was encrypted with Version 1, and AWS **automatically knows** to use Version 1 to decrypt it, even years later!

---

## Why Your .env Doesn't Need Updates

### The Magic of KMS Envelope Encryption:

When you call `kms:Decrypt`:

```php
$result = $kmsClient->decrypt([
    'CiphertextBlob' => $encryptedBlob, // Your CIPHERSWEET_KMS_ENCRYPTED_KEY
    'KeyId' => $this->kmsKeyId,
]);
```

**What AWS Does Internally:**

1. ✅ Reads metadata from `CiphertextBlob`
2. ✅ Sees: "Oh, this was encrypted with Key Version 1"
3. ✅ Automatically uses Key Version 1 to decrypt
4. ✅ Returns your plaintext CipherSweet key
5. ✅ No errors, no updates needed!

**You never need to specify the version** - AWS handles it automatically!

---

## When Would You Need to Update .env?

### ✅ You DON'T need to update .env when:
- AWS KMS key rotates automatically (annual)
- AWS KMS key is rotated manually by DevOps
- Key versions change
- 10 years pass and there are 10 key versions

### ❌ You ONLY need to update .env if:
1. **You rotate your CipherSweet key** (the actual data encryption key)
   - This requires re-encrypting ALL your data
   - Very rare - only if compromised

2. **You change to a different KMS key entirely**
   - Different Key ID/ARN
   - Update `CIPHERSWEET_KMS_KEY_ID`
   - Re-wrap your CipherSweet key with new KMS key
   - Update `CIPHERSWEET_KMS_ENCRYPTED_KEY`

3. **Initial setup**
   - When you first wrap your key

---

## Complete Flow Diagram

### Initial Setup (One Time Only):
```
┌─────────────────────────────────────────────────────────────┐
│ 1. You have: CipherSweet plaintext key                      │
│    "nacl:plain:key:..." (32 bytes)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Run: php artisan ciphersweet:wrap-key                    │
│    This encrypts your key with AWS KMS                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AWS KMS encrypts it with Key Version 1                   │
│    Metadata: {keyVersion: 1, algorithm: AES-256-GCM}       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. You get: Base64 encrypted blob                          │
│    CIPHERSWEET_KMS_ENCRYPTED_KEY="AQICAHh..."              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Add to .env - DONE! Never needs updating!               │
└─────────────────────────────────────────────────────────────┘
```

### After 1 Year - AWS Rotates KMS Key:
```
┌─────────────────────────────────────────────────────────────┐
│ AWS automatically creates Key Version 2                      │
│ Version 1 remains available for decryption                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Your Application Starts:                                     │
│ 1. Reads CIPHERSWEET_KMS_ENCRYPTED_KEY from .env           │
│ 2. Calls AWS KMS decrypt                                    │
│ 3. AWS sees: "encrypted with Version 1"                     │
│ 4. AWS uses Version 1 to decrypt                            │
│ 5. Returns your CipherSweet key                             │
│ 6. Everything works! No .env update needed!                 │
└─────────────────────────────────────────────────────────────┘
```

### After 5 Years - Multiple Rotations:
```
┌─────────────────────────────────────────────────────────────┐
│ KMS Key Versions: 1, 2, 3, 4, 5, 6 (6 is active)          │
│ Your encrypted key: Still uses Version 1                    │
│ AWS: Still works perfectly!                                  │
│ .env: UNCHANGED since initial setup!                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Proof: The Encrypted Blob Contains Version Info

Your `CIPHERSWEET_KMS_ENCRYPTED_KEY` is not just encrypted data - it's a **special AWS format** that includes metadata:

```
Structure of CIPHERSWEET_KMS_ENCRYPTED_KEY (base64 encoded):
┌──────────────────────────────────────────┐
│ Header (AWS format identifier)           │ ← AWS knows this is KMS encrypted
├──────────────────────────────────────────┤
│ Key ID (which KMS key)                   │ ← Which key to use
├──────────────────────────────────────────┤
│ Key Version (1, 2, 3, etc.)             │ ← Which version of the key
├──────────────────────────────────────────┤
│ Algorithm (AES-256-GCM)                  │ ← How it was encrypted
├──────────────────────────────────────────┤
│ Encryption Context                        │ ← Your Application name, Purpose
├──────────────────────────────────────────┤
│ Encrypted Data (your CipherSweet key)   │ ← The actual encrypted payload
├──────────────────────────────────────────┤
│ Authentication Tag                        │ ← Integrity verification
└──────────────────────────────────────────┘
```

**Because of this metadata, AWS always knows which key version to use for decryption!**

---

## What IS Rotating Then?

### AWS KMS Key Rotation (Automatic):
- **What rotates:** The KMS key material (cryptographic material)
- **Frequency:** Annual (365 days)
- **Impact on you:** ZERO - transparent
- **Action required:** NONE

### Your CipherSweet Key Rotation (Manual):
- **What rotates:** Your actual data encryption key
- **Frequency:** Only if compromised or for compliance
- **Impact on you:** Must re-encrypt ALL data
- **Action required:** Run `php artisan tenants:encrypt-family-history`

---

## Compliance Benefits

### What You Can Tell Auditors:

✅ **"Our encryption keys are rotated automatically"**
   - AWS KMS rotates annually
   - Industry best practice
   - No manual intervention
   - No downtime

✅ **"We use envelope encryption"**
   - Data Encryption Key (CipherSweet) encrypts data
   - Key Encryption Key (KMS) encrypts DEK
   - Two layers of security

✅ **"Key rotation is handled by AWS"**
   - FIPS 140-2 Level 2 validated
   - Automatic version management
   - Backward compatible
   - Audit trail in CloudTrail

✅ **"Old data remains accessible"**
   - No data re-encryption needed
   - AWS maintains all key versions
   - Seamless access

---

## Testing Key Rotation

You can't easily test annual rotation, but you can verify it will work:

### Test 1: Verify Key Metadata
```bash
aws kms describe-key --key-id your-key-id
```

Look for:
```json
{
  "KeyMetadata": {
    "KeyId": "abc-123",
    "KeyRotationEnabled": true,  ← Must be true
    "KeyState": "Enabled"
  }
}
```

### Test 2: Verify Decryption Works
```bash
php artisan ciphersweet:test-kms
```

Should show:
```
✓ KMS integration working
✓ Key decryption successful
```

### Test 3: Simulate Time Passing
Unfortunately, you can't force AWS to rotate immediately. But you can:

1. **Manually rotate** (creates new version immediately):
```bash
aws kms rotate-key-on-demand --key-id your-key-id
```

2. **Test your app still works** after manual rotation:
```bash
php artisan config:clear
php artisan ciphersweet:test-kms  # Should still work!
```

3. **Verify CloudTrail logs** show the rotation event

---

## Summary: You're Right - It's Fully Automated!

### What You Thought: ✅ Correct!
- AWS handles key rotation automatically
- No manual application updates needed
- Set it and forget it

### What You Were Concerned About: ❌ Not an issue!
- You DON'T need to update `CIPHERSWEET_KMS_ENCRYPTED_KEY`
- AWS KMS automatically uses the correct key version
- The encrypted blob contains version metadata

### Your Current Setup: ✅ Perfect!

```env
# These stay the same forever (unless you change KMS keys entirely)
CIPHERSWEET_KMS_KEY_ID=your-key-arn
CIPHERSWEET_KMS_ENCRYPTED_KEY=base64-encrypted-blob

# AWS handles rotation internally
# Your app continues to work seamlessly
```

---

## Final Recommendation

### Initial Setup:
1. ✅ Enable automatic rotation in KMS (you did this)
2. ✅ Wrap your CipherSweet key (you did this)
3. ✅ Store in `.env` (you did this)

### Ongoing:
1. ✅ Monitor CloudTrail for rotation events
2. ✅ Test decryption periodically
3. ✅ **DO NOTHING** - AWS handles everything!

### Only Update .env If:
- ❌ Switching to a different KMS key (different ARN)
- ❌ Rotating your CipherSweet key (data encryption key)
- ❌ Security incident requires key change

---

## You're All Set! 🎉

Your implementation is **exactly right**. AWS KMS will rotate the key material annually, and your application will continue to work without any manual updates to `.env`.

The beauty of AWS KMS envelope encryption is that it's **truly automatic** - you really can just enable rotation and forget about it!

